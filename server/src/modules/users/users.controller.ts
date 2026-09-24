import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { SessionGuard } from '../../common/guards/session.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';

@Controller('api')
@UseGuards(SessionGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users')
  @RequirePermissions('user.view')
  async getUsers(@Query('q') query?: string) {
    return this.usersService.getUsers(query);
  }

  @Get('users/:id')
  @RequirePermissions('user.view')
  async getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }
}
