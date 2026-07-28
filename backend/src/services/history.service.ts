import { prisma } from './prisma';

export interface RecordConversionInput {
  userId: number;
  originalFilename: string;
  sourceFormat: string;
  targetFormat: string;
  fileSizeBytes: number;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
}

export function recordConversion(input: RecordConversionInput) {
  return prisma.conversionHistory.create({ data: input });
}

export async function listHistory(userId: number, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    prisma.conversionHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.conversionHistory.count({ where: { userId } }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
