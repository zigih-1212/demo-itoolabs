/**
 * Репозиторий аутентификации — операции над refresh-сессиями.
 *
 * Здесь только данные: вставка, поиск, отзыв токенов. Правила
 * (кто имеет право получить токен) живут в auth.service.ts.
 */
import { getDatabase } from '../../db/connection.js';

interface RefreshRow {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface RefreshTokenRecord {
  id: number;
  userId: number;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

function toRecord(row: RefreshRow): RefreshTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

export const authRepository = {
  /** Сохраняет хэш нового refresh-токена. */
  createRefreshToken(input: {
    userId: number;
    tokenHash: string;
    expiresAt: string;
  }): void {
    getDatabase()
      .prepare(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES (?, ?, ?)`,
      )
      .run(input.userId, input.tokenHash, input.expiresAt);
  },

  /** Ищет сессию по хэшу токена. */
  findRefreshToken(tokenHash: string): RefreshTokenRecord | null {
    const row = getDatabase()
      .prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?')
      .get(tokenHash) as RefreshRow | undefined;
    return row ? toRecord(row) : null;
  },

  /** Помечает конкретную сессию отозванной (logout). */
  revokeToken(tokenHash: string): void {
    getDatabase()
      .prepare(
        `UPDATE refresh_tokens
         SET revoked_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE token_hash = ? AND revoked_at IS NULL`,
      )
      .run(tokenHash);
  },

  /** Отзывает все сессии пользователя (смена пароля, «выйти везде»). */
  revokeAllForUser(userId: number): void {
    getDatabase()
      .prepare(
        `UPDATE refresh_tokens
         SET revoked_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE user_id = ? AND revoked_at IS NULL`,
      )
      .run(userId);
  },

  /** Чистка истёкших токенов — вызывается при входе, чтобы таблица не росла. */
  deleteExpired(): void {
    getDatabase()
      .prepare(
        `DELETE FROM refresh_tokens
         WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
      )
      .run();
  },
};
