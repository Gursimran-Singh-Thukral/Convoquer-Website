import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { OperationsTasksService } from './operations-tasks.service.js';
import { SessionGuard } from '../../common/guards/session.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';
import {
  CreateOperationsTaskDto,
  UpdateOperationsTaskDto,
} from './dto/operations-tasks.dto.js';

@Controller('api/operations-tasks')
@UseGuards(SessionGuard)
export class OperationsTasksController {
  constructor(
    private readonly operationsTasksService: OperationsTasksService,
  ) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('task.view')
  async getTasks(
    @Query('department') department?: string,
    @Query('volunteerId') volunteerId?: string,
    @Query('status') status?: string,
    @Req() req?: Request,
  ) {
    return this.operationsTasksService.getTasks((req as any).user.id, {
      department,
      volunteerId,
      status,
    });
  }

  @Get('assignees')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('task.create')
  async getAssignees(@Req() req: Request) {
    return this.operationsTasksService.getAssignableVolunteers(
      (req as any).user.id,
    );
  }

  @Get('summary')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('task.view')
  async getSummary(@Req() req: Request) {
    return this.operationsTasksService.getSummary((req as any).user.id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('task.create')
  async createTask(@Body() dto: CreateOperationsTaskDto, @Req() req: Request) {
    const userId = (req as any).user?.id;
    return this.operationsTasksService.createTask(dto, userId);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('task.update')
  async updateTask(
    @Param('id') id: string,
    @Body() dto: UpdateOperationsTaskDto,
    @Req() req: Request,
  ) {
    return this.operationsTasksService.updateTask(
      id,
      dto,
      (req as any).user.id,
    );
  }
}
