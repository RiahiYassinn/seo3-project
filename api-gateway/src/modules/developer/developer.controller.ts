import { Controller, Get, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('developers')
@Controller('developers')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class DeveloperController {
  @Get()
  @ApiOperation({ summary: 'Get all developers' })
  findAll() {
    return { message: 'Get all developers - proxied to Developer Service' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get developer by ID' })
  findOne(@Param('id') id: string) {
    return { message: `Get developer ${id} - proxied to Developer Service` };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update developer' })
  update(@Param('id') id: string, @Body() _updateDto: any) {
    return { message: `Update developer ${id} - proxied to Developer Service` };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete developer' })
  remove(@Param('id') id: string) {
    return { message: `Delete developer ${id} - proxied to Developer Service` };
  }
}
