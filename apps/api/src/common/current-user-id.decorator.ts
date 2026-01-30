import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const CurrentUserId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): number => {
    const req = ctx.switchToHttp().getRequest();

    // passport-jwt puts payload in req.user
    const sub = req.user?.sub;

    if (!Number.isFinite(sub) || sub <= 0) {
      throw new UnauthorizedException('Missing/invalid JWT identity');
    }

    return Number(sub);
  },
);
