import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const USERNAME_RE = /^[a-zA-Z0-9_-]+$/;

export class CredentialsDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(USERNAME_RE)
  username!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;
}

export class CreateUserDto extends CredentialsDto {
  @IsIn(['admin', 'member'])
  role!: 'admin' | 'member';
}

export class UpdateUserDto {
  @IsOptional()
  @IsIn(['admin', 'member'])
  role?: 'admin' | 'member';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password?: string;
}

export class LoginDto {
  @IsString()
  @MaxLength(64)
  username!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}
