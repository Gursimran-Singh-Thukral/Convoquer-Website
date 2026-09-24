import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { readGoogleSheet } from '../../common/import/google-sheet.js';
import { validateDto } from '../../common/validation/request-validation.pipe.js';
import type { Request } from 'express';
import { VolunteersService } from './volunteers.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { SessionGuard } from '../../common/guards/session.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator.js';
import {
  CreateVolunteerDto,
  UpdateVolunteerDto,
  ImportVolunteersDto,
  VolunteerSheetDto,
  VolunteerCheckInDto,
} from './dto/volunteers.dto.js';

@Controller('api/volunteers')
export class VolunteersController {
  constructor(
    private readonly volunteersService: VolunteersService,
    private readonly rbacService: RbacService,
  ) {}

  /**
   * "My department's roster" — a Head/Coordinator (or Convener/Co-Convener via
   * volunteer.manage) sees only their own department's volunteers, never the
   * whole org's. A plain volunteer holds neither permission and gets a 403,
   * not an empty list, so the restriction is visible rather than silent.
   * Must stay above `:id` in route order.
   */
  @Get('roster')
  @UseGuards(SessionGuard)
  async getMyRoster(@Req() req: Request) {
    const userId = (req as any).user.id;
    const [canManageAll, canViewOwnDepartment] = await Promise.all([
      this.rbacService.hasPermission(userId, 'volunteer.manage'),
      this.rbacService.hasPermission(userId, 'volunteer.view.department'),
    ]);
    if (!canManageAll && !canViewOwnDepartment) {
      throw new ForbiddenException(
        'Insufficient permissions: Missing permission "volunteer.manage" or "volunteer.view.department"',
      );
    }
    return this.volunteersService.getRosterForUser(userId);
  }

  @Get()
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('volunteer.manage')
  async getVolunteers(
    @Query('department') department?: string,
    @Query('shift') shift?: string,
    @Query('status') status?: string,
    @Query('venueId') venueId?: string,
  ) {
    return this.volunteersService.getVolunteers({
      department,
      shift,
      status,
      venueId,
    });
  }

  /**
   * Public, field-limited roster (name + department only) for the audience-facing
   * "point of contact" display on /live. Must stay above `:id` in route order.
   */
  @Get('public')
  async getPublicVolunteers(@Query('venueName') venueName?: string) {
    return this.volunteersService.getPublicVolunteers(venueName);
  }

  /**
   * Self-service: the logged-in volunteer reports which venue they're at right
   * now. Only requires a session — a volunteer doesn't need `volunteer.manage`
   * to check themselves in.
   */
  @Post('me/check-in')
  @UseGuards(SessionGuard)
  async checkIn(@Body() dto: VolunteerCheckInDto, @Req() req: Request) {
    return this.volunteersService.checkIn((req as any).user.id, dto);
  }

  @Post('import-sheet')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('volunteer.manage')
  async readSheet(@Body() dto: VolunteerSheetDto) {
    const rows = await readGoogleSheet(dto.sheetUrl);
    rows.forEach((row) => validateDto(row, 'VolunteerImportRowDto'));
    return { rows };
  }

  @Post('import')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('volunteer.manage')
  async importVolunteers(
    @Body() dto: ImportVolunteersDto,
    @Req() req: Request,
  ) {
    return this.volunteersService.importVolunteers(dto, (req as any).user.id);
  }

  @Get(':id')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('volunteer.manage')
  async getVolunteerById(@Param('id') id: string) {
    return this.volunteersService.getVolunteerById(id);
  }

  /**
   * Backend Only: Register volunteer. Guarded by session + volunteer.manage authorization.
   */
  @Post()
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('volunteer.manage')
  async createVolunteer(@Body() dto: CreateVolunteerDto, @Req() req: Request) {
    const userId = (req as any).user?.id;
    return this.volunteersService.createVolunteer(dto, userId);
  }

  /**
   * Backend Only: Update volunteer details/shift/status.
   */
  @Patch(':id')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('volunteer.manage')
  async updateVolunteer(
    @Param('id') id: string,
    @Body() dto: UpdateVolunteerDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    return this.volunteersService.updateVolunteer(id, dto, userId);
  }

  /**
   * Backend Only: Remove volunteer.
   */
  @Delete(':id')
  @UseGuards(SessionGuard, PermissionsGuard)
  @RequirePermissions('volunteer.manage')
  async deleteVolunteer(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as any).user?.id;
    return this.volunteersService.deleteVolunteer(id, userId);
  }
}
