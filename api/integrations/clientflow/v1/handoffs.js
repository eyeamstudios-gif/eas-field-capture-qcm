import { createClientFlowReceiver } from '../../../../lib/server/clientflow-receiver.js';
import { handoffSchema } from '../../../../lib/server/schemas.js';

export default createClientFlowReceiver('handoff', handoffSchema);
