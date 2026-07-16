import { Controller, Post, Param, Body, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ChatService } from './chat.service';
import { ChatStreamDto } from './dto/chat-stream.dto';

@Controller('pocs/:id/chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post('stream')
  @Sse()
  stream(@Param('id') pocId: string, @Body() body: ChatStreamDto): Observable<MessageEvent> {
    return this.chatService.streamChat(pocId, body.messages);
  }
}
