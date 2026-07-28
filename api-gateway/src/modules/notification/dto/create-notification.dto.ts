import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateNotificationDto {
  @IsOptional()
  @IsUUID()
  recipientUserId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  recipientUserIds?: string[];

  @IsOptional()
  @IsString()
  @IsIn(['admin', 'developer', 'tech_lead'])
  recipientRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;

  @IsString()
  @MaxLength(160)
  title: string;

  @IsString()
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  link?: string;

  @IsOptional()
  @IsString()
  @IsIn(['info', 'success', 'warning', 'critical'])
  priority?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
