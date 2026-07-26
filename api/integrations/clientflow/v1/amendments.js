import { createClientFlowReceiver } from '../../../../lib/server/clientflow-receiver.js';
import { amendmentSchema } from '../../../../lib/server/schemas.js';

export const POST = createClientFlowReceiver('amendment', amendmentSchema);
