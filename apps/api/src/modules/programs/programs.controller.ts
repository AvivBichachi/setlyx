import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ProgramsService } from './programs.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { CurrentUserId } from '../../common/current-user-id.decorator';

@Controller('programs')
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) { }

  @Post()
  create(@CurrentUserId() userId: number, @Body() dto: CreateProgramDto) {
    return this.programsService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUserId() userId: number,) {
    return this.programsService.findAll(userId);
  }

  @Get(':id')
  findOne(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.programsService.findOne(userId, id);
  }

  @Get(':id/detailed')
  findOneDetailed(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.programsService.findOneDetailed(userId, id);
  }

  @Patch(':id')
  update(@CurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProgramDto,
  ) {
    return this.programsService.update(userId, id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUserId() userId: number, @Param('id', ParseIntPipe) id: number) {
    await this.programsService.remove(userId, id);
    return { ok: true };
  }
}