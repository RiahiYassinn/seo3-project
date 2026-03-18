import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SyncReposDto {
  @ApiProperty({ description: 'GitHub integration ID' })
  @IsUUID()
  @IsNotEmpty()
  integrationId: string;

  @ApiProperty({ example: 'octocat', description: 'GitHub username' })
  @IsString()
  @IsNotEmpty()
  username: string;
}
