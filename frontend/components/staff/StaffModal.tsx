'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { STAFF_ROLE_META } from '@/types/staff';
import type { StaffMember, StaffRole } from '@/types/staff';

const createSchema = z.object({
  firstName:  z.string().min(2, 'Ism kiritilishi shart'),
  lastName:   z.string().min(2, 'Familiya kiritilishi shart'),
  middleName: z.string().optional(),
  email:      z.string().email("To'g'ri email kiriting"),
  password:   z.string().min(8, 'Parol kamida 8 ta belgi'),
  role:       z.enum(['manager', 'ustoz']),
  phone:      z.string().optional(),
});

const editSchema = z.object({
  firstName:  z.string().min(2, 'Ism kiritilishi shart'),
  lastName:   z.string().min(2, 'Familiya kiritilishi shart'),
  middleName: z.string().optional(),
  role:       z.enum(['manager', 'ustoz']),
  phone:      z.string().optional(),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm   = z.infer<typeof editSchema>;

interface Props {
  staff:   StaffMember | null; // null = yangi qo'shish
  onClose: () => void;
}

const INPUT = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white';
const LABEL = 'text-xs font-medium text-gray-600 mb-1 block';

export default function StaffModal({ staff, onClose }: Props) {
  const qc     = useQueryClient();
  const isEdit = !!staff;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(isEdit ? editSchema : createSchema) as never,
    defaultValues: isEdit ? {
      firstName:  staff.firstName,
      lastName:   staff.lastName,
      middleName: staff.middleName ?? '',
      role:       staff.role,
      phone:      staff.phone ?? '',
    } : { role: 'ustoz' },
  });

  useEffect(() => {
    if (staff) {
      reset({
        firstName:  staff.firstName,
        lastName:   staff.lastName,
        middleName: staff.middleName ?? '',
        role:       staff.role,
        phone:      staff.phone ?? '',
      });
    }
  }, [staff]);

  const saveMut = useMutation({
    mutationFn: (data: CreateForm) =>
      isEdit
        ? api.patch(`/users/${staff!.id}`, data)
        : api.post('/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      onClose();
    },
  });

  function onSubmit(data: CreateForm) {
    saveMut.mutate(data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
        {/* Sarlavha */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            {isEdit ? `${staff!.firstName} ${staff!.lastName}` : '➕ Yangi xodim'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          {/* Ism / Familiya */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Ism *</label>
              <input {...register('firstName')} className={INPUT} placeholder="Ism" />
              {errors.firstName && <p className="text-red-500 text-[10px] mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className={LABEL}>Familiya *</label>
              <input {...register('lastName')} className={INPUT} placeholder="Familiya" />
              {errors.lastName && <p className="text-red-500 text-[10px] mt-1">{errors.lastName.message}</p>}
            </div>
          </div>

          {/* Otasining ismi */}
          <div>
            <label className={LABEL}>Otasining ismi (ixtiyoriy)</label>
            <input {...register('middleName')} className={INPUT} placeholder="Sharipovich" />
          </div>

          {/* Email (faqat yangi qo'shishda) */}
          {!isEdit && (
            <div>
              <label className={LABEL}>Email *</label>
              <input {...register('email')} type="email" className={INPUT} placeholder="user@example.com" />
              {errors.email && <p className="text-red-500 text-[10px] mt-1">{errors.email.message}</p>}
            </div>
          )}

          {/* Parol (faqat yangi qo'shishda) */}
          {!isEdit && (
            <div>
              <label className={LABEL}>Parol *</label>
              <input {...register('password')} type="password" className={INPUT} placeholder="Kamida 8 ta belgi" />
              {errors.password && <p className="text-red-500 text-[10px] mt-1">{errors.password.message}</p>}
            </div>
          )}

          {/* Rol */}
          <div>
            <label className={LABEL}>Rol *</label>
            <div className="flex gap-3">
              {(['manager', 'ustoz'] as StaffRole[]).map(r => {
                const meta = STAFF_ROLE_META[r];
                return (
                  <label key={r} className="flex-1 flex items-center gap-2 cursor-pointer">
                    <input
                      {...register('role')}
                      type="radio"
                      value={r}
                      className="accent-emerald-600"
                    />
                    <span className={`text-sm font-medium px-3 py-1.5 rounded-xl w-full text-center border transition-colors ${meta.bg} ${meta.color} border-current/20`}>
                      {meta.label}
                    </span>
                  </label>
                );
              })}
            </div>
            {errors.role && <p className="text-red-500 text-[10px] mt-1">{errors.role.message}</p>}
          </div>

          {/* Telefon */}
          <div>
            <label className={LABEL}>Telefon (ixtiyoriy)</label>
            <input {...register('phone')} className={INPUT} placeholder="+998901234567" />
          </div>

          {/* Xato xabari */}
          {saveMut.isError && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">
              {(saveMut.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Saqlashda xatolik yuz berdi'}
            </p>
          )}

          {/* Tugmalar */}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              Bekor
            </button>
            <button type="submit" disabled={saveMut.isPending}
              className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 transition-colors">
              {saveMut.isPending ? 'Saqlanmoqda...' : (isEdit ? '💾 Saqlash' : '➕ Qo\'shish')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
