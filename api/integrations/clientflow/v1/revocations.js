import { createClientFlowReceiver } from '../../../../lib/server/clientflow-receiver.js';
import { revocationSchema } from '../../../../lib/server/schemas.js';

export const POST = createClientFlowReceiver('revocation', revocationSchema);
