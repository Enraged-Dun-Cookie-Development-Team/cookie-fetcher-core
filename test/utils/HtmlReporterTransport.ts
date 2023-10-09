import { LogItem, Transport } from '@enraged-dun-cookie-development-team/common/logger';

const { addMsg } = await import('jest-html-reporters/helper');

const formatArg = (value: unknown, i: number): string => {
  let delim = ' ';
  let out: string;
  if (typeof value === 'string') {
    out = value;
  } else if (typeof value === 'object' && value) {
    delim = '\n';
    out = JSON.stringify(value, null, 2) + '\n';
  } else {
    out = String(value);
  }
  return (i ? delim : '') + out;
};

export const HtmlReporterTransport: Transport = {
  name: '',
  level: 0,
  handle(item: LogItem): void {
    void addMsg({ context: undefined, message: item.msg.map(formatArg).join('') });
  },
  close(): Promise<void> {
    return Promise.resolve();
  },
};
