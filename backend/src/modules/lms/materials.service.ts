import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Material, MaterialType } from '../../entities/material.entity';
import { Group } from '../../entities/group.entity';
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MinioService } from './minio.service';
import { CreateMaterialDto, UpdateMaterialDto } from './dto/material.dto';

@Injectable()
export class MaterialsService {
  constructor(
    @InjectRepository(Material)
    private materialRepo: Repository<Material>,
    @InjectRepository(Group)
    private groupRepo: Repository<Group>,
    private minioService: MinioService,
    private auditLog: AuditLogService,
  ) {}

  // ─── FAYL YUKLASH (MinIO) ─────────────────────────────────────────────────
  async uploadFile(
    file: Express.Multer.File,
    materialType: MaterialType,
    actorId: string,
  ): Promise<{ url: string; objectName: string }> {
    const typeMap: Record<MaterialType, string> = {
      [MaterialType.PDF]: 'pdf',
      [MaterialType.VIDEO]: 'video',
      [MaterialType.AUDIO]: 'audio',
      [MaterialType.IMAGE]: 'image',
      [MaterialType.LINK]: 'link',
      [MaterialType.OTHER]: 'other',
    };

    const folder = `materials/${typeMap[materialType]}/${actorId}`;
    const result = await this.minioService.uploadBuffer(
      file.buffer,
      file.originalname,
      file.mimetype,
      folder,
    );

    return { url: result.url, objectName: result.objectName };
  }

  // ─── MATERIAL YARATISH ────────────────────────────────────────────────────
  async create(
    dto: CreateMaterialDto,
    actorId: string,
    actorRole: string,
    fileUrl?: string,
    fileSize?: number,
  ) {
    if (dto.type !== MaterialType.LINK && !fileUrl) {
      throw new BadRequestException('Fayl yuklanishi kerak');
    }

    if (dto.groupId) {
      const group = await this.groupRepo.findOne({ where: { id: dto.groupId } });
      if (!group) throw new NotFoundException('Guruh topilmadi');
      if (!group.isActive) {
        throw new BadRequestException('Nofaol guruh uchun material yuklab bo\'lmaydi');
      }
    }

    let url = fileUrl ?? dto.fileUrl ?? '';
    // Qo'lda kiritilgan havola (type=link) sxemasiz bo'lsa (masalan
    // "youtube.com/..."), brauzer uni CRM'ning o'z sahifasiga nisbatan
    // NISBIY manzil deb hisoblab, yuklab olishda 404'ga olib boradi
    if (dto.type === MaterialType.LINK && url && !/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    const material = this.materialRepo.create({
      title: dto.title,
      type: dto.type,
      fileUrl: url,
      fileSize: fileSize ?? null,
      groupId: dto.groupId ?? null,
      lessonId: dto.lessonId ?? null,
      uploadedById: actorId,
      description: dto.description ?? null,
      isVisible: dto.isVisible ?? true,
    });

    await this.materialRepo.save(material);

    await this.auditLog.log({
      userId: actorId, userRole: actorRole,
      action: 'MATERIAL_UPLOADED',
      entityName: 'materials', entityId: material.id,
      newValues: { title: dto.title, type: dto.type },
    });

    return material;
  }

  async findAll(query: { groupId?: string; lessonId?: string; type?: MaterialType }, actorId: string, actorRole: string) {
    const qb = this.materialRepo
      .createQueryBuilder('m')
      .leftJoin('m.uploadedBy', 'u')
      .where('m.deleted_at IS NULL')
      .addSelect(['m.id','m.title','m.type','m.fileUrl','m.fileSize',
                  'm.isVisible','m.description','m.createdAt',
                  'u.id','u.firstName','u.lastName']);

    // O'quvchi faqat ko'rinadigan materiallarni oladi
    if (actorRole === Role.STUDENT) qb.andWhere('m.is_visible = true');

    if (query.groupId) qb.andWhere('m.group_id = :gid', { gid: query.groupId });
    if (query.lessonId) qb.andWhere('m.lesson_id = :lid', { lid: query.lessonId });
    if (query.type) qb.andWhere('m.type = :type', { type: query.type });

    return qb.orderBy('m.created_at', 'DESC').getMany();
  }

  async findOne(id: string) {
    const m = await this.materialRepo.findOne({
      where: { id },
      relations: { uploadedBy: true },
    });
    if (!m) throw new NotFoundException('Material topilmadi');
    return m;
  }

  async update(id: string, dto: UpdateMaterialDto, actorId: string, actorRole: string) {
    const material = await this.materialRepo.findOne({ where: { id } });
    if (!material) throw new NotFoundException('Material topilmadi');

    if (actorRole === Role.USTOZ && material.uploadedById !== actorId) {
      throw new ForbiddenException('Bu material sizniki emas');
    }

    await this.materialRepo.update(id, {
      ...(dto.title && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description ?? null }),
      ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
    });

    return this.materialRepo.findOne({ where: { id } });
  }

  async remove(id: string, actorId: string, actorRole: string) {
    const material = await this.materialRepo.findOne({ where: { id } });
    if (!material) throw new NotFoundException('Material topilmadi');

    if (actorRole === Role.USTOZ && material.uploadedById !== actorId) {
      throw new ForbiddenException('Bu material sizniki emas');
    }

    // MinIO dan o'chirish
    if (material.fileUrl && !material.fileUrl.startsWith('http')) {
      await this.minioService.deleteObject(material.fileUrl);
    }

    await this.materialRepo.softDelete(id);

    await this.auditLog.log({
      userId: actorId, userRole: actorRole,
      action: 'MATERIAL_DELETED',
      entityName: 'materials', entityId: id,
    });

    return { message: 'Material o\'chirildi' };
  }
}
