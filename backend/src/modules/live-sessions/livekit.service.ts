import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AccessToken } from 'livekit-server-sdk';

export type ParticipantRole = 'host' | 'participant';

@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);

  private get apiKey(): string | undefined {
    return process.env.LIVEKIT_API_KEY;
  }
  private get apiSecret(): string | undefined {
    return process.env.LIVEKIT_API_SECRET;
  }
  private get url(): string | undefined {
    return process.env.LIVEKIT_URL;
  }

  get isConfigured(): boolean {
    return !!(this.apiKey && this.apiSecret && this.url);
  }

  // ─── QO'SHILISH TOKENI ────────────────────────────────────────────────────
  async createJoinToken(params: {
    roomName: string;
    identity: string;
    displayName: string;
    role: ParticipantRole;
  }): Promise<{ token: string; url: string }> {
    if (!this.isConfigured) {
      this.logger.warn('LIVEKIT_API_KEY/SECRET/URL sozlanmagan — video xizmati mavjud emas');
      throw new ServiceUnavailableException(
        "Video xizmati hali sozlanmagan — Super Admin Livekit API kalitlarini qo'shishi kerak",
      );
    }

    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: params.identity,
      name: params.displayName,
      ttl: '4h',
    });

    at.addGrant({
      room: params.roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: params.role === 'host',
    });

    const token = await at.toJwt();
    return { token, url: this.url! };
  }
}
