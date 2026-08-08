'use client';

import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';

interface Props {
  token:    string;
  url:      string;
  onLeave:  () => void;
}

export default function LiveVideoRoom({ token, url, onLeave }: Props) {
  return (
    <div className="h-[80vh] min-h-[420px] rounded-2xl overflow-hidden border border-gray-100" data-lk-theme="default">
      <LiveKitRoom
        serverUrl={url}
        token={token}
        connect
        video
        audio
        onDisconnected={onLeave}
        style={{ height: '100%' }}
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}
