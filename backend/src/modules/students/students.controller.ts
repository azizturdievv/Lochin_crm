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
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { QueryStudentDto } from './dto/query-student.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../entities/user.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  // O'quvchi ro'yxati — manager, ustoz, super_admin
  @Get()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  findAll(@Query() query: QueryStudentDto, @CurrentUser() user: User) {
    return this.studentsService.findAll(query, user.id, user.role);
  }

  // Yangi o'quvchi qo'shish — manager, super_admin
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateStudentDto, @CurrentUser() user: User) {
    return this.studentsService.create(dto, user.id, user.role);
  }

  // O'quvchi ma'lumotlari — barcha rollar (o'quvchi faqat o'zini)
  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.studentsService.findOne(id, user.id, user.role);
  }

  // O'quvchi ma'lumotlarini yangilash — manager, super_admin
  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser() user: User,
  ) {
    return this.studentsService.update(id, dto, user.id, user.role);
  }

  // Soft delete — faqat super_admin
  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.studentsService.remove(id, user.id, user.role);
  }

  // O'quvchi progressi — barcha rollar
  @Get(':id/progress')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.studentsService.getProgress(id, user.id, user.role);
  }

  // Ota-onalar ro'yxati — manager, super_admin, ustoz
  @Get(':id/parents')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  getParents(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.getParents(id);
  }

  // Guruhga yozish — manager, super_admin
  @Post(':id/enroll')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  enroll(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnrollStudentDto,
    @CurrentUser() user: User,
  ) {
    return this.studentsService.enroll(id, dto, user.id, user.role);
  }

  // Guruhdan chiqarish — manager, super_admin
  @Delete(':id/enrollments/:enrollmentId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  unenroll(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @CurrentUser() user: User,
  ) {
    return this.studentsService.unenroll(id, enrollmentId, user.id, user.role);
  }
}
