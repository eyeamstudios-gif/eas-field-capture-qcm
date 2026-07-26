import { createClientFlowReceiver } from '../../../../lib/server/clientflow-receiver.js';
import { amendmentSchema } from '../../../../lib/server/schemas.js';

export default createClientFlowReceiver('amendment', amendmentSchema);
