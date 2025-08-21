import { Env } from '@/env';

export interface HandlerProps {
	request: Request;
	env: Env;
	locationHint: DurableObjectLocationHint;
}
