import { Controller, Get, Post, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ArchiveService } from './archive.service';
import { QueryArchiveDto, ArchiveEntityType } from './dto/query-archive.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../entities/user.entity';

// Faqat SA — mavjud kodda "o'chirish" darajasidagi amallar (students/staff/
// groups DELETE) barchasi allaqachon SUPER_ADMIN bilan cheklangan, Arxiv
// bo'limi ham shu konventsiyaga mos keladi
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('api/v1/archive')
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  @Get()
  list(@Query() query: QueryArchiveDto) {
    return this.archiveService.list(query);
  }

  @Get(':entityType/:id')
  getDetail(
    @Param('entityType') entityType: ArchiveEntityType,
    @Param('id') id: string,
  ) {
    return this.archiveService.getDetail(entityType, id);
  }

  @Get('history/:entityType/:entityId')
  getHistory(
    @Param('entityType') entityType: ArchiveEntityType,
    @Param('entityId') entityId: string,
  ) {
    return this.archiveService.getHistory(entityType, entityId);
  }

  @Post(':entityType/:id/restore')
  @HttpCode(HttpStatus.OK)
  restore(
    @Param('entityType') entityType: ArchiveEntityType,
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.archiveService.restore(entityType, id, user.id, user.role);
  }
}
