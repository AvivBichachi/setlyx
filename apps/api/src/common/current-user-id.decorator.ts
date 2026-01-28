import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export const CurrentUserId = createParamDecorator((_: unknown, ctx: ExecutionContext): number => {
  const req = ctx.switchToHttp().getRequest();
  const raw = req.headers['x-user-id'];

  const parsed =
    typeof raw === 'string'
      ? Number(raw)
      : Array.isArray(raw)
        ? Number(raw[0])
        : NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new UnauthorizedException('Missing/invalid user identity');
  }

  return parsed;
});