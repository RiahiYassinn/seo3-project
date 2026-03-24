import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class LinkGithubDto {
  @IsString()
  @IsNotEmpty()
  github_username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  github_token: string;
}