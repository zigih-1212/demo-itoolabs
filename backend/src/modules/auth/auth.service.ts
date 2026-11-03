/**
 * Сервис аутентификации — вход, регистрация, продление и выход.
 *
 * Здесь сосредоточены правила безопасности:
 *  - Registration НЕ даёт роль admin по умолчанию — новые пользователи
 *    всегда 'agent'. Повышать права может только администратор через
 *    модуль users. Это защита от «самоназначения админом».
 *  - При входе мы не различаем «нет такого e-mail» и «неверный пароль» —
 *    возвращаем одну ошибку. Иначе злоумышленник сможет перебором узнать,
 *    какие адреса зарегистрированы.
 *  - При обновлении (refresh) старая сессия отзывается, выдаётся новая —
 *    так называемая «ротация refresh-токенов». Она ограничивает окно
 *    атаки при краже токена.
 */
import { usersRepository } from '../users/users.repository.js';
import { authRepository } from './auth.repository.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import {
  generateRefreshToken,
  hashToken,
  refreshTokenExpiry,
  signAccessToken,
  verifyAccessToken,
} from '../../lib/tokens.js';
import { ConflictError, UnauthorizedError } from '../../lib/errors.js';
import { activityRepository } from '../activity/activity.repository.js';
import type { AuthResult, User } from '../../domain/types.js';
import type { LoginBody, RegisterBody } from './auth.schema.js';

/** Палитра аватаров — совпадает с логикой в users.service. */
const AVATAR_PALETTE = [
  '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
];

function pickAvatarColor(seed: string): string {
  let sum = 0;
  for (const char of seed) sum += char.charCodeAt(0);
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length] as string;
}

/** Выдаёт новую пару токенов и сохраняет refresh-сессию. */
function issueTokens(user: User): AuthResult {
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  const refreshToken = generateRefreshToken();
  authRepository.createRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshTokenExpiry(),
  });

  return { accessToken, refreshToken, user };
}

export const authService = {
  /**
   * Регистрация. В демо-проекте открытая (чтобы можно было создать аккаунт),
   * но новые пользователи получают роль 'agent'. В реальном B2B-продукте
   * регистрация была бы только по приглашению администратора организации.
   */
  async register(body: RegisterBody): Promise<AuthResult> {
    if (usersRepository.findByEmail(body.email)) {
      throw new ConflictError('Пользователь с таким e-mail уже зарегистрирован');
    }

    const passwordHash = await hashPassword(body.password);
    const user = usersRepository.create({
      email: body.email,
      passwordHash,
      fullName: body.fullName,
      role: 'agent',
      avatarColor: pickAvatarColor(body.email),
    });

    activityRepository.log({
      actorId: user.id,
      action: 'auth.registered',
      entityType: 'user',
      entityId: user.id,
    });

    return issueTokens(user);
  },

  /** Вход по e-mail и паролю. */
  async login(body: LoginBody): Promise<AuthResult> {
    // Периодическая уборка просроченных токенов — дешёво и не даёт таблице расти.
    authRepository.deleteExpired();

    const record = usersRepository.findByEmail(body.email);
    // Не раскрываем, что именно неверно (e-mail или пароль) — сказано выше.
    if (!record) {
      throw new UnauthorizedError('Неверный e-mail или пароль');
    }

    const valid = await verifyPassword(body.password, record.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Неверный e-mail или пароль');
    }

    const { passwordHash: _passwordHash, ...user } = record;

    activityRepository.log({
      actorId: user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
    });

    return issueTokens(user);
  },

  /**
   * Продление сессии по refresh-токену.
   * Реализована ротация: старый токен гасится, выдаётся новый.
   */
  async refresh(refreshToken: string): Promise<AuthResult> {
    const tokenHash = hashToken(refreshToken);
    const session = authRepository.findRefreshToken(tokenHash);

    if (!session) throw new UnauthorizedError('Сессия не найдена');
    if (session.revokedAt) throw new UnauthorizedError('Сессия отозвана');
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      throw new UnauthorizedError('Сессия истекла');
    }

    const record = usersRepository.findById(session.userId);
    if (!record) throw new UnauthorizedError('Пользователь не найден');

    // Ротация: гасим использованный токен...
    authRepository.revokeToken(tokenHash);
    const { passwordHash: _passwordHash, ...user } = record;
    // ...и выдаём свежую пару.
    return issueTokens(user);
  },

  /** Выход: отзывает конкретную refresh-сессию. */
  logout(refreshToken: string): void {
    authRepository.revokeToken(hashToken(refreshToken));
  },

  /** Текущий пользователь по access-токену (используется в /me). */
  me(accessToken: string): User {
    const payload = verifyAccessToken(accessToken);
    const record = usersRepository.findById(payload.sub);
    if (!record) throw new UnauthorizedError('Пользователь не найден');
    const { passwordHash: _passwordHash, ...user } = record;
    return user;
  },
};
