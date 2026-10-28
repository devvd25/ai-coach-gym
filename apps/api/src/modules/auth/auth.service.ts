import type { AuthResponse, ConsentInput, LoginInput, RegisterInput, User } from '@ai-coach/shared';
import { AppError } from '../../lib/http.js';
import type { UserRecord, UserRepository } from '../users/user.repository.js';
import type { PasswordHasher } from './password.js';
import type { TokenService } from './token.service.js';

export interface AuthService {
  register(input: RegisterInput): Promise<AuthResponse>;
  login(input: LoginInput): Promise<AuthResponse>;
  me(userId: number): Promise<User>;
  giveConsent(userId: number, input: ConsentInput): Promise<User>;
}

export function toUserDto(u: UserRecord): User {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    healthConsentAt: u.healthConsentAt ? u.healthConsentAt.toISOString() : null,
    consents: { camera: u.consentCamera, research: u.consentResearch },
    hasProfile: u.hasProfile,
  };
}

const INVALID_LOGIN = new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');

export function createAuthService(deps: {
  users: UserRepository;
  hasher: PasswordHasher;
  tokens: TokenService;
}): AuthService {
  const { users, hasher, tokens } = deps;
  // Compared against when the email is unknown, so both failure paths take similar time.
  const dummyHash = hasher.hash('not-a-real-password-1A');

  async function issue(user: UserRecord): Promise<AuthResponse> {
    const { token, expiresAt } = await tokens.sign(user.id);
    return { token, expiresAt: expiresAt.toISOString(), user: toUserDto(user) };
  }

  async function requireUser(userId: number): Promise<UserRecord> {
    const user = await users.findById(userId);
    if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập không còn hợp lệ');
    return user;
  }

  return {
    async register(input) {
      if (await users.findByEmail(input.email)) {
        throw new AppError(409, 'EMAIL_TAKEN', 'Email này đã được đăng ký', {
          email: 'Email này đã được đăng ký',
        });
      }
      const user = await users.create({
        email: input.email,
        fullName: input.fullName,
        passwordHash: await hasher.hash(input.password),
      });
      return issue(user);
    },

    async login(input) {
      const user = await users.findByEmail(input.email);
      if (!user) {
        await hasher.compare(input.password, await dummyHash);
        throw INVALID_LOGIN;
      }
      if (!(await hasher.compare(input.password, user.passwordHash))) throw INVALID_LOGIN;
      return issue(user);
    },

    async me(userId) {
      return toUserDto(await requireUser(userId));
    },

    async giveConsent(userId, input) {
      await requireUser(userId);
      await users.setConsent(
        userId,
        { camera: input.camera, research: input.research },
        new Date(),
      );
      return toUserDto(await requireUser(userId));
    },
  };
}
