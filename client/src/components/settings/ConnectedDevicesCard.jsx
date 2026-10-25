import React from 'react';
import { Laptop } from 'lucide-react';

function parseDeviceInfo() {
  const ua = navigator.userAgent;
  let os = 'Unknown OS';
  let browser = 'Unknown browser';
  let device = 'Device';

  if (/Macintosh|Mac OS X/.test(ua)) os = 'macOS';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Linux/.test(ua)) os = 'Linux';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';

  if (/Chrome/.test(ua) && !/Edg/.test(ua)) browser = 'Chrome';
  else if (/Firefox/.test(ua)) browser = 'Firefox';
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/Edg/.test(ua)) browser = 'Edge';
  else browser = ua.split(')')[0].split('(')[1] || 'Browser';

  if (/Macintosh/.test(ua)) device = 'MacBook Air';
  else if (/Windows/.test(ua)) device = 'Windows PC';
  else if (/Linux/.test(ua)) device = 'Linux Machine';
  else if (/iPhone|iPad/.test(ua)) device = 'Apple Device';
  else if (/Android/.test(ua)) device = 'Android Device';

  return { os, browser, device };
}

export function ConnectedDevicesCard() {
  const info = parseDeviceInfo();

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-foreground mb-1">Connected devices</h3>
      <p className="text-xs text-muted-foreground mb-4">Devices currently logged in to your account.</p>

      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
        <Laptop className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate">{info.device}</p>
            <span className="text-[10px] bg-terracotta/10 text-terracotta px-1.5 py-0.5 rounded-full shrink-0">
              Current device
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {info.os} · {info.browser}
          </p>
          <p className="text-xs text-muted-foreground">Last active: Now</p>
        </div>
      </div>
    </div>
  );
}
