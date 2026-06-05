import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../entities/user.entity';
import { PointsService } from './points.service';
import { BadgeService } from './badge.service';
import { BookService } from './book.service';
import { VocabularyService } from './vocabulary.service';
import { LeaderboardService } from './leaderboard.service';
import {
  AwardPointsDto,
  CreateBookDto,
  AssignBookDto,
  SubmitBookTestDto,
  AddWordDto,
  SubmitVocabTestDto,
  AwardMonthlyRewardDto,
  LeaderboardQueryDto,
} from './dto/gamification.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/gamification')
export class GamificationController {
  constructor(
    private readonly pointsService: PointsService,
    private readonly badgeService: BadgeService,
    private readonly bookService: BookService,
    private readonly vocabularyService: VocabularyService,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  // ─── REYTING ──────────────────────────────────────────────────────────────
  @Get('leaderboard')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getLeaderboard(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardService.getLeaderboard({
      role: query.role as any ?? 'student',
      period: query.period as any ?? 'monthly',
      limit: query.limit ? Number(query.limit) : 10,
    });
  }

  // ─── MENING STATISTIKAM ────────────────────────────────────────────────────
  @Get('my-stats')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getMyStats(@CurrentUser() user: User) {
    return this.pointsService.getUserStats(user.id);
  }

  @Get('my-history')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getMyHistory(
    @CurrentUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.pointsService.getHistory(user.id, Math.min(limit, 100), page);
  }

  @Get('progress')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getProgress(
    @CurrentUser() user: User,
    @Query('limit', new DefaultValuePipe(6), ParseIntPipe) limit: number,
  ) {
    return this.leaderboardService.getProgressHistory(user.id, limit);
  }

  // ─── BALL BERISH/KAMAYTIRISH (SA, Manager) ────────────────────────────────
  @Post('points/award')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  awardPoints(@Body() dto: AwardPointsDto, @CurrentUser() user: User) {
    return this.pointsService.award({
      userId: dto.userId,
      action: dto.action,
      points: dto.points,
      description: dto.description,
      referenceId: dto.referenceId,
      referenceType: dto.referenceType,
      actorId: user.id,
      actorRole: user.role,
    });
  }

  // ─── BADGE'LAR ────────────────────────────────────────────────────────────
  @Get('badges')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getMyBadges(@CurrentUser() user: User) {
    return this.badgeService.getUserBadges(user.id);
  }

  @Get('badges/:userId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getUserBadges(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.badgeService.getUserBadges(userId);
  }

  @Get('badges-stats')
  @Roles(Role.SUPER_ADMIN)
  getBadgeStats() {
    return this.badgeService.getStats();
  }

  // ─── KITOBXONLIK ──────────────────────────────────────────────────────────
  @Get('books')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getBooks(@Query('month') month?: string) {
    return month ? this.bookService.findAll(month) : this.bookService.getCurrentBooks();
  }

  @Post('books')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  createBook(@Body() dto: CreateBookDto, @CurrentUser() user: User) {
    return this.bookService.create(dto, user.id, user.role);
  }

  @Post('books/:id/assign')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  assignBook(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignBookDto,
    @CurrentUser() user: User,
  ) {
    return this.bookService.assign(id, dto, user.id);
  }

  @Post('books/:id/test/generate')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  generateTest(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.bookService.generateTest(id, user.id, user.role);
  }

  @Post('books/:id/test/start')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  @HttpCode(HttpStatus.CREATED)
  startTest(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.bookService.startTest(id, user.id);
  }

  @Post('books/test/:testId/submit')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  submitTest(
    @Param('testId', ParseUUIDPipe) testId: string,
    @Body() dto: SubmitBookTestDto,
    @CurrentUser() user: User,
  ) {
    return this.bookService.submitTest(testId, dto, user.id);
  }

  @Get('books/:id/stats')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getBookStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.bookService.getStats(id);
  }

  @Get('my-books')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getMyBookHistory(@CurrentUser() user: User) {
    return this.bookService.getUserTests(user.id);
  }

  // ─── LUG'AT ───────────────────────────────────────────────────────────────
  @Get('vocabulary')
  @Roles(Role.STUDENT, Role.SUPER_ADMIN, Role.MANAGER)
  getVocabulary(
    @CurrentUser() user: User,
    @Query('language') language?: string,
    @Query('mastered') mastered?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ) {
    return this.vocabularyService.getWords(user.id, {
      language,
      mastered: mastered !== undefined ? mastered === 'true' : undefined,
      page,
      limit,
    });
  }

  @Post('vocabulary')
  @Roles(Role.STUDENT, Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  addWord(@Body() dto: AddWordDto, @CurrentUser() user: User) {
    return this.vocabularyService.addWord(dto, user.id);
  }

  @Post('vocabulary/:id/define')
  @Roles(Role.STUDENT, Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  generateDefinition(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    // Agar so'z foydalanuvchiga tegishli bo'lsa, ta'rifni yangilaydi
    return this.vocabularyService.generateDefinition(id, '', 'uz');
  }

  @Delete('vocabulary/:id')
  @Roles(Role.STUDENT, Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  removeWord(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.vocabularyService.removeWord(id, user.id);
  }

  @Get('vocabulary/stats')
  @Roles(Role.STUDENT, Role.SUPER_ADMIN, Role.MANAGER)
  getVocabStats(@CurrentUser() user: User) {
    return this.vocabularyService.getUserStats(user.id);
  }

  @Get('vocabulary/weekly-test')
  @Roles(Role.STUDENT)
  getWeeklyTest(@CurrentUser() user: User) {
    return this.vocabularyService.getWeeklyTest(user.id);
  }

  @Post('vocabulary/weekly-test/submit')
  @Roles(Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  submitWeeklyTest(@Body() dto: SubmitVocabTestDto, @CurrentUser() user: User) {
    return this.vocabularyService.submitWeeklyTest(dto, user.id);
  }

  // ─── MUKOFOTLAR (SA) ──────────────────────────────────────────────────────
  @Post('rewards/award-monthly')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  awardMonthlyRewards(@Body() dto: AwardMonthlyRewardDto, @CurrentUser() user: User) {
    return this.leaderboardService.awardMonthlyRewards(dto.month, user.id);
  }
}
