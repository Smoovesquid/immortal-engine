export const SOCKET_STATES = ['latent', 'resolved'];

export const SOCKET_AFFORDANCES = [
  'inspect',
  'open',
  'move',
  'activate'
];

export function validateSocket(socket) {
  if (typeof socket.id !== 'string') {
    throw new Error('Invalid socket: id must be string');
  }

  if (!SOCKET_AFFORDANCES.includes(socket.affordance)) {
    throw new Error('Invalid socket: unknown affordance');
  }

  if (!SOCKET_STATES.includes(socket.state)) {
    throw new Error('Invalid socket: invalid state');
  }

  return true;
}
