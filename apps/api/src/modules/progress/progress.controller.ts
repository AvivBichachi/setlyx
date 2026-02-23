import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../../common/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetProgressQueryDto } from './dto/get-progress.query.dto';
import { ProgressService } from './progress.service';

@UseGuards(JwtAuthGuard)
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('context')
  getContext(@CurrentUserId() userId: number) {
    return this.progressService.getContext(userId);
  }

  @Get()
  getSeries(
    @CurrentUserId() userId: number,
    @Query() query: GetProgressQueryDto,
  ) {
    return this.progressService.getSeries(userId, query);
  }
}
