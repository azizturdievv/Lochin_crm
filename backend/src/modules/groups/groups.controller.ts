import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto, UpdateGroupDto, QueryGroupDto } from './dto/group.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../entities/user.entity';

@Controller('api/v1/groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  // Guruhlar ro'yxati — SA, Manager, Ustoz (ustoz o'zniki)
  @Get()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  findAll(@Query() query: QueryGroupDto, @CurrentUser() user: User) {
    return this.groupsService.findAll(query, user.id, user.role);
  }

  // Bitta guruh
  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.findOne(id);
  }

  // Guruh yaratish — SA, Manager
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateGroupDto, @CurrentUser() user: User) {
    return this.groupsService.create(dto, user.id, user.role);
  }

  // Guruh yangilash — SA, Manager
  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGroupDto,
    @CurrentUser() user: User,
  ) {
    return this.groupsService.update(id, dto, user.id, user.role);
  }

  // Guruhni deaktivatsiya — faqat SA
  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.groupsService.remove(id, user.id, user.role);
  }
}
