/**
 * Centralized application state
 * @type {Object}
 */
const state = {
  ws: null,
  sessionToken: localStorage.getItem('session_token') || null,
  user: null,
  hubs: [],
  channels: [],
  currentHubId: null,
  currentChannelId: null,
  selectedHubIdForChannelCreation: null,
  messages: new Map(),
  callId: null,
  callChannelId: null,
  selfPeerId: null,
  peerConnections: new Map(),
  ice: null,
  audioStream: null,
  videoStream: null,
  screenStream: null,
  streamTiles: new Map(),
  remoteAudioEls: new Map(),
  remoteInboundStreamsByPeer: new Map(),
  pendingIceByPeer: new Map(),
  pendingAuthRequest: null,
  channelCallMap: new Map(),
  toastTimer: null,
  voiceActive: false,
  sidebarMenuOpen: false,
  micMuted: false,
  textChatDrawerOpen: false,
  reconnectTimer: null,
  wsConnectTimer: null,
  reconnectAttempts: 0,
  lastSocketEvent: 'init',
  lastSocketError: ''
}

/**
 * DOM query selector shorthand
 * @param {string} selector - CSS selector
 * @returns {Element|null}
 */
const qs = (selector) => document.querySelector(selector)

/**
 * DOM elements for easy reference
 * @type {Object}
 */
const dom = {
  status: qs('#status'),
  userPill: qs('#user-pill'),
  logoutBtn: qs('#logout-btn'),
  authCard: qs('#auth-card'),
  authHint: qs('#auth-hint'),
  signupTab: qs('#signup-tab'),
  signinTab: qs('#signin-tab'),
  signupForm: qs('#signup-form'),
  signinForm: qs('#signin-form'),
  inviteInput: qs('#invite'),
  handleInput: qs('#handle'),
  signupPasswordInput: qs('#signup-password'),
  signinHandleInput: qs('#signin-handle'),
  signinPasswordInput: qs('#signin-password'),
  redeemBtn: qs('#redeem'),
  signinBtn: qs('#signin-btn'),
  signinHint: qs('#signin-hint'),
  toast: qs('#toast'),
  mobileDiagnostics: qs('#mobile-diagnostics'),
  layout: qs('.layout'),
  chatCard: qs('.chat'),
  mobileMenuBtn: qs('#mobile-menu-btn'),
  sidebar: qs('#sidebar-menu'),
  sidebarOverlay: qs('#sidebar-overlay'),
  adminPanel: qs('#admin-panel'),
  hubsList: qs('#hubs-list'),
  activeRoom: qs('#active-room'),
  messages: qs('#messages'),
  searchResults: qs('#search-results'),
  streams: qs('#streams'),
  streamsEmpty: qs('#streams-empty'),
  textChatToggle: qs('#text-chat-toggle'),
  textChatClose: qs('#text-chat-close'),
  textChatDrawer: qs('#text-chat-drawer'),
  adminInvite: qs('#admin-invite'),
  adminInviteSide: qs('#admin-invite-side'),
  createAdminInviteBtn: qs('#create-admin-invite'),
  createAdminInviteSideBtn: qs('#create-admin-invite-side'),
  createHubBtn: qs('#create-hub-btn'),
  createHubModal: qs('#create-hub-modal'),
  closeCreateHubModalBtn: qs('#close-create-hub-modal'),
  modalHubName: qs('#modal-hub-name'),
  modalHubDescription: qs('#modal-hub-description'),
  modalHubVisibility: qs('#modal-hub-visibility'),
  modalCreateHubBtn: qs('#modal-create-hub'),
  modalHubCancelBtn: qs('#modal-hub-cancel'),
  startCallBtn: qs('#start-call'),
  toggleMediaBtn: qs('#toggle-media'),
  shareScreenBtn: qs('#share-screen'),
  hangupCallBtn: qs('#hangup-call'),
  addMemberBtn: qs('#add-member'),
  voiceHint: qs('#voice-hint'),
  roomNameInput: qs('#room-name'),
  roomKindSelect: qs('#room-kind'),
  createRoomModal: qs('#create-room-modal'),
  closeCreateRoomModalBtn: qs('#close-create-room-modal'),
  modalCancelBtn: qs('#modal-cancel'),
  modalCreateRoomBtn: qs('#modal-create-room'),
  modalRoomName: qs('#modal-room-name'),
  modalRoomKind: qs('#modal-room-kind'),
  modalRoomVisibility: qs('#modal-room-visibility'),
  modalHubSelect: qs('#modal-hub-select'),
  addMemberModal: qs('#add-member-modal'),
  closeAddMemberModalBtn: qs('#close-add-member-modal'),
  memberSearchInput: qs('#member-search-input'),
  memberSearchResults: qs('#member-search-results'),
  closeAddMemberBtn: qs('#close-add-member-btn'),
  sendMessageBtn: qs('#send-message'),
  messageInput: qs('#message-input'),
  searchBtn: qs('#search-btn'),
  searchInput: qs('#search-input')
}

const MOBILE_SIDEBAR_BREAKPOINT = 900

const isMobileViewport = () => window.innerWidth <= MOBILE_SIDEBAR_BREAKPOINT

const syncSidebarMenuUi = () => {
  if (!dom.mobileMenuBtn || !dom.sidebar || !dom.sidebarOverlay) {
    return
  }
  dom.mobileMenuBtn.setAttribute('aria-expanded', state.sidebarMenuOpen ? 'true' : 'false')
  dom.sidebar.classList.toggle('mobile-open', state.sidebarMenuOpen)
  dom.sidebarOverlay.classList.toggle('show', state.sidebarMenuOpen)
}

const setSidebarMenuOpen = (isOpen) => {
  if (!state.user || !isMobileViewport()) {
    state.sidebarMenuOpen = false
  } else {
    state.sidebarMenuOpen = Boolean(isOpen)
  }
  syncSidebarMenuUi()
}

const getChannelById = (channelId) => state.channels.find((channel) => channel.channel_id === channelId) || null

const isVoiceChannel = (channelId) => getChannelById(channelId)?.kind === 'voice'

const syncTextChatDrawerUi = () => {
  if (!dom.textChatToggle || !dom.textChatDrawer) {
    return
  }
  dom.textChatToggle.textContent = state.textChatDrawerOpen ? '>' : '<'
  dom.textChatToggle.setAttribute('aria-expanded', state.textChatDrawerOpen ? 'true' : 'false')
  dom.textChatDrawer.classList.toggle('open', state.textChatDrawerOpen)
}

const setTextChatDrawerOpen = (isOpen) => {
  state.textChatDrawerOpen = Boolean(isOpen)
  syncTextChatDrawerUi()
}

const updateChannelLayoutMode = () => {
  if (!dom.chatCard) {
    return
  }
  const inVoiceChannel = isVoiceChannel(state.currentChannelId)
  dom.chatCard.classList.toggle('voice-channel', inVoiceChannel)
  dom.chatCard.classList.toggle('text-channel', !inVoiceChannel)
  if (!inVoiceChannel) {
    setTextChatDrawerOpen(false)
  }
}

/**
 * Set connection status text
 * @param {string} text
 */
const setStatus = (text) => {
  dom.status.textContent = text
  renderMobileDiagnostics()
}

const wsReadyStateText = () => {
  if (!state.ws) return 'none'
  switch (state.ws.readyState) {
    case WebSocket.CONNECTING: return 'connecting'
    case WebSocket.OPEN: return 'open'
    case WebSocket.CLOSING: return 'closing'
    case WebSocket.CLOSED: return 'closed'
    default: return 'unknown'
  }
}

const renderMobileDiagnostics = () => {
  return
  if (!dom.mobileDiagnostics) {
    return
  }
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  const wsUrl = `${protocol}://${location.host}/ws`
  dom.mobileDiagnostics.textContent = [
    `page: ${location.href}`,
    `secureContext: ${window.isSecureContext}`,
    `ws: ${wsReadyStateText()}`,
    `url: ${wsUrl}`,
    `event: ${state.lastSocketEvent || '-'}`,
    `retries: ${state.reconnectAttempts}`,
    state.lastSocketError ? `error: ${state.lastSocketError}` : ''
  ].filter(Boolean).join('\n')
}

const rtcDebugEnabled = new URLSearchParams(window.location.search).get('rtcdebug') === '1'
let rtcDebugPanel = null

const ensureRtcDebugPanel = () => {
  if (!rtcDebugEnabled || rtcDebugPanel) {
    return
  }
  const panel = document.createElement('pre')
  panel.id = 'rtc-debug-panel'
  panel.style.position = 'fixed'
  panel.style.left = '8px'
  panel.style.right = '8px'
  panel.style.bottom = '8px'
  panel.style.zIndex = '9999'
  panel.style.maxHeight = '35vh'
  panel.style.overflow = 'auto'
  panel.style.margin = '0'
  panel.style.padding = '8px'
  panel.style.background = 'rgba(0, 0, 0, 0.85)'
  panel.style.color = '#9df8a3'
  panel.style.font = '11px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  panel.style.border = '1px solid rgba(157, 248, 163, 0.4)'
  panel.style.borderRadius = '8px'
  panel.textContent = '[RTC] debug overlay enabled (?rtcdebug=1)\n'
  document.body.appendChild(panel)
  rtcDebugPanel = panel
}

const appendRtcDebugLine = (level, message, payload) => {
  if (!rtcDebugEnabled) {
    return
  }
  ensureRtcDebugPanel()
  if (!rtcDebugPanel) {
    return
  }
  const ts = new Date().toISOString().slice(11, 23)
  let payloadText = ''
  if (payload !== undefined) {
    try {
      payloadText = ` ${JSON.stringify(payload)}`
    } catch (error) {
      payloadText = ' [unserializable payload]'
    }
  }
  rtcDebugPanel.textContent += `${ts} ${level} ${message}${payloadText}\n`
  const lines = rtcDebugPanel.textContent.split('\n')
  if (lines.length > 180) {
    rtcDebugPanel.textContent = `${lines.slice(lines.length - 180).join('\n')}\n`
  }
  rtcDebugPanel.scrollTop = rtcDebugPanel.scrollHeight
}

const rtcInfo = (message, payload) => {
  if (payload === undefined) {
    console.info(message)
  } else {
    console.info(message, payload)
  }
  appendRtcDebugLine('INFO', message, payload)
}

const rtcWarn = (message, payload) => {
  if (payload === undefined) {
    console.warn(message)
  } else {
    console.warn(message, payload)
  }
  appendRtcDebugLine('WARN', message, payload)
}

/**
 * Show notification toast (auto-hides after 3.2s)
 * @param {string} text
 */
const showToast = (text) => {
  dom.toast.textContent = text
  dom.toast.classList.add('show')
  window.clearTimeout(state.toastTimer)
  state.toastTimer = window.setTimeout(() => {
    dom.toast.classList.remove('show')
  }, 3200)
}

/**
 * Update UI visibility based on auth state
 */
const setAuthUi = () => {
  if (state.user) {
    dom.userPill.textContent = `@${state.user.handle}`
    dom.logoutBtn.classList.remove('hidden')
    dom.authCard.classList.add('hidden')
    dom.layout.classList.remove('hidden')
    if (state.user.roles?.includes('admin')) {
      dom.adminPanel.classList.remove('hidden')
    } else {
      dom.adminPanel.classList.add('hidden')
    }
    setSidebarMenuOpen(false)
    setTextChatDrawerOpen(false)
    showToast('Signed in. Create a channel or invite someone')
  } else {
    dom.userPill.textContent = 'signed out'
    dom.logoutBtn.classList.add('hidden')
    dom.authCard.classList.remove('hidden')
    dom.layout.classList.add('hidden')
    dom.adminPanel.classList.add('hidden')
    setSidebarMenuOpen(false)
    setTextChatDrawerOpen(false)
  }
  updateChannelLayoutMode()
}

/**
 * Send a message to the server
 * @param {string} messageType - Message type identifier
 * @param {Object} body - Message payload
 */
const buildEnvelope = (messageType, body) => ({
  v: 1,
  t: messageType,
  id: `${messageType}-${Date.now()}`,
  ts: Date.now(),
  body
})

const flushPendingAuthRequest = () => {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    return
  }
  if (!state.pendingAuthRequest) {
    return
  }
  const pending = state.pendingAuthRequest
  state.pendingAuthRequest = null
  state.ws.send(JSON.stringify(buildEnvelope(pending.messageType, pending.body)))
}

const sendAuthRequest = (messageType, body) => {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    send(messageType, body)
    return
  }
  state.pendingAuthRequest = { messageType, body }
  connect()
  const pendingMsg = 'Connecting... sign-in will be sent automatically'
  dom.authHint.textContent = pendingMsg
  dom.signinHint.textContent = pendingMsg
  showToast(pendingMsg)
}

const send = (messageType, body) => {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    const message = 'Connection not ready. Please wait...'
    dom.authHint.textContent = message
    dom.signinHint.textContent = message
    showToast(message)
    return
  }
  state.ws.send(JSON.stringify(buildEnvelope(messageType, body)))
}

const scheduleReconnect = () => {
  if (state.reconnectTimer) {
    return
  }
  const attempt = state.reconnectAttempts + 1
  state.reconnectAttempts = attempt
  state.lastSocketEvent = 'reconnect_scheduled'
  const delayMs = Math.min(1000 * (2 ** (attempt - 1)), 10000)
  setStatus(`reconnecting (${attempt})`)
  state.reconnectTimer = window.setTimeout(() => {
    state.reconnectTimer = null
    connect()
  }, delayMs)
}

const clearWsConnectTimer = () => {
  if (!state.wsConnectTimer) {
    return
  }
  window.clearTimeout(state.wsConnectTimer)
  state.wsConnectTimer = null
}

/**
 * Establish WebSocket connection to server
 */
const connect = () => {
  if (state.ws && (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING)) {
    return
  }

  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  state.ws = new WebSocket(`${protocol}://${location.host}/ws`)
  state.lastSocketEvent = 'connect_start'
  state.lastSocketError = ''
  setStatus('connecting')
  clearWsConnectTimer()
  state.wsConnectTimer = window.setTimeout(() => {
    if (!state.ws || state.ws.readyState !== WebSocket.CONNECTING) {
      return
    }
    state.lastSocketEvent = 'connect_timeout'
    state.lastSocketError = 'socket open timed out after 10s'
    setStatus('socket timeout')
    try {
      state.ws.close()
    } catch (error) {
      // ignore close errors during timeout recovery
    }
    scheduleReconnect()
  }, 10000)

  state.ws.addEventListener('open', () => {
    clearWsConnectTimer()
    state.reconnectAttempts = 0
    if (state.reconnectTimer) {
      window.clearTimeout(state.reconnectTimer)
      state.reconnectTimer = null
    }
    state.lastSocketEvent = 'open'
    setStatus('connected')
    send('hello', {
      client: { name: 'hubot-chat-p2p-web', ver: '0.1.0', platform: 'browser' },
      resume: { session_token: state.sessionToken }
    })
    flushPendingAuthRequest()
  })

  state.ws.addEventListener('close', (event) => {
    clearWsConnectTimer()
    state.lastSocketEvent = 'close'
    state.lastSocketError = `close ${event.code}${event.reason ? ` (${event.reason})` : ''}`
    setStatus('disconnected')
    if (state.pendingAuthRequest) {
      const pendingMsg = 'Still connecting... retrying websocket'
      dom.authHint.textContent = pendingMsg
      dom.signinHint.textContent = pendingMsg
    }
    scheduleReconnect()
  })

  state.ws.addEventListener('error', () => {
    clearWsConnectTimer()
    state.lastSocketEvent = 'error'
    state.lastSocketError = 'socket error'
    setStatus('socket error')
    renderMobileDiagnostics()
  })

  state.ws.addEventListener('message', (event) => {
    state.lastSocketEvent = 'message'
    renderMobileDiagnostics()
    const msg = JSON.parse(event.data)
    handleMessage(msg)
  })
}

/**
 * Handle authentication success and restore session
 * @param {Object} msg
 */
const handleAuthSession = (msg) => {
  state.user = msg.body.user
  state.sessionToken = msg.body.session_token
  localStorage.setItem('session_token', state.sessionToken)
  send('hub.list', {})
  requestChannels()
  setAuthUi()
  showToast('Welcome. You are now signed in')
}

/**
 * Handle error responses from server
 * @param {Object} msg
 */
const handleError = (msg) => {
  const errorMsg = msg.body?.message || 'Server error'
  dom.authHint.textContent = errorMsg
  dom.signinHint.textContent = errorMsg
  showToast(errorMsg)

  if (
    msg.reply_to?.startsWith('rtc.join-') &&
    msg.body?.code === 'NOT_FOUND' &&
    isVoiceChannel(state.currentChannelId)
  ) {
    state.channelCallMap.delete(state.currentChannelId)
    ensureVoiceStateForChannel(state.currentChannelId)
    return
  }

  if (msg.body?.message?.includes('Not a member') && state.currentChannelId) {
    send('channel.join', { channel_id: state.currentChannelId })
  }
}

const isValidSdp = (value) => typeof value === 'string' && value.trim().startsWith('v=')

const summarizeSdpMedia = (sdp) => {
  if (!isValidSdp(sdp)) {
    return null
  }
  const lines = sdp.split(/\r?\n/)
  const summary = {}
  let currentKind = null
  for (const line of lines) {
    if (line.startsWith('m=')) {
      if (line.startsWith('m=audio')) currentKind = 'audio'
      else if (line.startsWith('m=video')) currentKind = 'video'
      else currentKind = null
      continue
    }
    if (!currentKind || !line.startsWith('a=')) {
      continue
    }
    if (line === 'a=sendrecv' || line === 'a=sendonly' || line === 'a=recvonly' || line === 'a=inactive') {
      summary[currentKind] = line.slice(2)
    }
  }
  return summary
}

/**
 * Handle incoming offer from peer
 * @param {Object} body - rtc.offer_event body
 */
const handleOffer = async (body) => {
  if (!isValidSdp(body?.sdp)) {
    console.warn('Ignoring invalid rtc.offer_event SDP', body)
    return
  }
  rtcInfo('[RTC] offer received', {
    fromPeerId: body.from_peer_id,
    callId: body.call_id,
    media: summarizeSdpMedia(body.sdp)
  })
  const pc = createPeerConnection(body.from_peer_id)
  rtcInfo('[RTC] local tracks before attach', {
    toPeerId: body.from_peer_id,
    audioTracks: state.audioStream?.getAudioTracks().length || 0,
    videoTracks: state.videoStream?.getVideoTracks().length || 0,
    screenTracks: state.screenStream?.getVideoTracks().length || 0,
    senderTracks: pc.getSenders().map((sender) => sender.track?.kind || 'none')
  })
  await pc.setRemoteDescription({ type: 'offer', sdp: body.sdp })
  await attachLocalTracks(pc)
  rtcInfo('[RTC] local tracks after attach', {
    toPeerId: body.from_peer_id,
    senderTracks: pc.getSenders().map((sender) => sender.track?.kind || 'none')
  })
  const pending = state.pendingIceByPeer.get(body.from_peer_id) || []
  for (const candidate of pending) {
    await pc.addIceCandidate(candidate)
  }
  state.pendingIceByPeer.delete(body.from_peer_id)
  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)
  rtcInfo('[RTC] answer created', {
    toPeerId: body.from_peer_id,
    callId: body.call_id,
    media: summarizeSdpMedia(answer.sdp)
  })
  send('rtc.answer', {
    call_id: body.call_id,
    to_peer_id: body.from_peer_id,
    from_peer_id: state.selfPeerId,
    sdp: answer.sdp
  })
}

/**
 * Handle incoming answer from peer
 * @param {Object} body - rtc.answer_event body
 */
const handleAnswer = async (body) => {
  if (!isValidSdp(body?.sdp)) {
    console.warn('Ignoring invalid rtc.answer_event SDP', body)
    return
  }
  const pc = state.peerConnections.get(body.from_peer_id)
  if (!pc) {
    rtcWarn('[RTC] answer ignored, missing peer connection', {
      fromPeerId: body.from_peer_id,
      callId: body.call_id
    })
    return
  }
  rtcInfo('[RTC] answer received', {
    fromPeerId: body.from_peer_id,
    callId: body.call_id,
    media: summarizeSdpMedia(body.sdp)
  })
  await pc.setRemoteDescription({ type: 'answer', sdp: body.sdp })
  const pending = state.pendingIceByPeer.get(body.from_peer_id) || []
  for (const candidate of pending) {
    await pc.addIceCandidate(candidate)
  }
  state.pendingIceByPeer.delete(body.from_peer_id)
}

/**
 * Handle incoming ICE candidate from peer
 * @param {Object} body - rtc.ice_event body
 */
const handleIce = async (body) => {
  const pc = state.peerConnections.get(body.from_peer_id)
  if (!pc) {
    rtcWarn('[RTC] ICE ignored, missing peer connection', {
      fromPeerId: body.from_peer_id,
      callId: body.call_id
    })
    return
  }
  if (body.candidate) {
    rtcInfo('[RTC] ICE received', {
      fromPeerId: body.from_peer_id,
      type: body.candidate.type || null,
      hasRemoteDescription: Boolean(pc.remoteDescription)
    })
    if (!pc.remoteDescription) {
      const pending = state.pendingIceByPeer.get(body.from_peer_id) || []
      pending.push(body.candidate)
      state.pendingIceByPeer.set(body.from_peer_id, pending)
      rtcInfo('[RTC] ICE queued until remote description', {
        fromPeerId: body.from_peer_id,
        queued: pending.length
      })
      return
    }
    await pc.addIceCandidate(body.candidate)
  }
}

/**
 * Handle peer join/leave events
 * @param {Object} body - rtc.peer_event body
 */
const handlePeerEvent = (body) => {
  if (body.kind === 'join' && body.peer?.peer_id && body.peer.peer_id !== state.selfPeerId) {
    rtcInfo('[RTC] peer join event', {
      peerId: body.peer.peer_id,
      callId: body.call_id
    })
    // Only establish the peer connection here. The joining peer initiates offers
    // from rtc.participants to avoid simultaneous offer glare.
    createPeerConnection(body.peer.peer_id)
  }
  if (body.kind === 'leave' && body.peer?.peer_id) {
    rtcInfo('[RTC] peer leave event', {
      peerId: body.peer.peer_id,
      callId: body.call_id
    })
    closePeer(body.peer.peer_id)
  }
}

/**
 * Message type dispatcher
 * @type {Object<string, Function>}
 */
/**
 * Handle error responses from server
 * @param {Object} msg
 */

const messageHandlers = {
  hello_ack: (msg) => {
    if (msg.body?.session?.authenticated) {
      state.user = msg.body.session.user
      state.sessionToken = msg.body.session.session_token || state.sessionToken
      localStorage.setItem('session_token', state.sessionToken)
      send('hub.list', {})
      requestChannels()
      setAuthUi()
    } else {
      setAuthUi()
    }
  },
  'auth.session': handleAuthSession,
  'admin.invite': (msg) => {
    dom.adminInvite.value = msg.body.invite_token
    dom.adminInviteSide.value = msg.body.invite_token
  },
  'hub.list_result': (msg) => {
    state.hubs = msg.body.hubs || []
    renderHubs()
  },
  'hub.created': (msg) => {
    const exists = state.hubs.some(h => h.hub_id === msg.body.hub.hub_id)
    if (!exists) {
      state.hubs.push(msg.body.hub)
      showToast(`Hub "${msg.body.hub.name}" created successfully`)
      if (dom.createHubModal && dom.createHubModal.close) dom.createHubModal.close()
      renderHubs()
    }
  },
  'hub.updated': (msg) => {
    const hubIndex = state.hubs.findIndex(h => h.hub_id === msg.body.hub.hub_id)
    if (hubIndex !== -1) {
      state.hubs[hubIndex] = msg.body.hub
      renderHubs()
      showToast(`Hub renamed to "${msg.body.hub.name}"`)
    }
  },
  'hub.deleted': (msg) => {
    applyHubDeleted(msg.body || {})
    showToast('Hub deleted')
  },
  'channel.list_result': (msg) => {
    state.channels = msg.body.channels || []
    renderChannels()
    if (!state.currentChannelId && state.channels.length > 0) {
      setActiveChannel(state.channels[0].channel_id)
    }
    if (state.channels.length === 0 && state.user?.roles?.includes('admin')) {
      send('channel.create', { hub_id: 'default', kind: 'text', name: 'general', visibility: 'public' })
    }
  },
  'channel.member_event': (msg) => {
    if (msg.body?.kind === 'join' && msg.body?.target_user_id === state.user?.user_id) {
      if (msg.body?.channel_id === state.currentChannelId) {
        send('msg.list', { channel_id: state.currentChannelId, after_seq: 0, limit: 200 })
      }
    }
  },
  'channel.created': (msg) => {
    const exists = state.channels.some(c => c.channel_id === msg.body.channel.channel_id)
    if (!exists) {
      state.channels.push(msg.body.channel)
      renderChannels()
      // Only auto-activate when this client created the channel (reply_to present).
      if (msg.reply_to) {
        setActiveChannel(msg.body.channel.channel_id)
      }
    }
  },
  'channel.updated': (msg) => {
    const channelIndex = state.channels.findIndex(c => c.channel_id === msg.body.channel.channel_id)
    if (channelIndex !== -1) {
      state.channels[channelIndex] = msg.body.channel
      renderChannels()
      if (msg.body.channel.channel_id === state.currentChannelId) {
        dom.activeRoom.textContent = msg.body.channel.name
        updateChannelLayoutMode()
        ensureVoiceStateForChannel(state.currentChannelId)
        updateCallControls()
      }
      showToast(`Channel renamed to "${msg.body.channel.name}"`)
    }
  },
  'channel.deleted': (msg) => {
    applyChannelDeleted(msg.body || {})
    showToast('Channel deleted')
  },
  'channel.added': (msg) => {
    const existingChannel = state.channels.find(c => c.channel_id === msg.body.channel_id)
    if (!existingChannel) {
      state.channels.push(msg.body)
      renderChannels()
      showToast(`Added to channel: ${msg.body.name}`)
    }
  },
  'msg.event': (msg) => {
    addMessage(msg.body.channel_id, msg.body.msg)
  },
  'msg.list_result': (msg) => {
    state.messages.set(msg.body.channel_id, msg.body.messages)
    renderMessages(msg.body.channel_id)
    cacheMessages(msg.body.channel_id)
  },
  'search.result': (msg) => {
    renderSearch(msg.body.hits || [])
  },
  'rtc.call_event': (msg) => {
    state.channelCallMap.set(msg.body.channel_id, msg.body.call_id)
    if (!state.callId && isVoiceChannel(state.currentChannelId) && state.currentChannelId === msg.body.channel_id) {
      ensureVoiceStateForChannel(state.currentChannelId)
    }
    updateCallControls()
  },
  'rtc.call': (msg) => {
    state.callId = msg.body.call_id
    state.callChannelId = msg.body.channel_id
    state.ice = msg.body.ice
    send('rtc.join', { call_id: state.callId, peer_meta: { device: 'browser', capabilities: { screen: true } } })
    updateCallControls()
  },
  'rtc.participants': (msg) => {
    rtcInfo('[RTC] participants', {
      callId: msg.body?.call_id,
      selfPeerId: msg.body?.self_peer_id,
      peerCount: (msg.body?.peers || []).length,
      hasIce: Boolean(msg.body?.ice)
    })
    if (msg.body?.ice) {
      state.ice = msg.body.ice
    }
    state.selfPeerId = msg.body.self_peer_id
    ensurePeers(msg.body.peers || [])
    if (state.voiceActive) {
      startAudio()
    }
  },
  'rtc.peer_event': (msg) => handlePeerEvent(msg.body || {}),
  'rtc.offer_event': (msg) => handleOffer(msg.body || {}),
  'rtc.answer_event': (msg) => handleAnswer(msg.body || {}),
  'rtc.ice_event': (msg) => handleIce(msg.body || {}),
  'rtc.stream_event': () => {
    // stream events are informational
  },
  'rtc.call_end': (msg) => {
    state.channelCallMap.delete(msg.body.channel_id)
    const matchesActiveCall = msg.body.call_id && state.callId && msg.body.call_id === state.callId
    const matchesActiveChannel = msg.body.channel_id && state.callChannelId && msg.body.channel_id === state.callChannelId
    if (matchesActiveCall || matchesActiveChannel) {
      teardownCall()
    }
  },
  'user.search_result': (msg) => {
    const users = msg.body.users || []
    dom.memberSearchResults.innerHTML = users.map(user => `
      <div class='member-search-item' data-user-id='${user.user_id}'>
        <span>${user.profile?.display_name || user.profile?.handle || user.user_id}</span>
        <button class='add-user-btn' data-user-id='${user.user_id}'>Add</button>
      </div>
    `).join('')
    
    // Add click listeners to "Add" buttons
    dom.memberSearchResults.querySelectorAll('.add-user-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const userId = btn.getAttribute('data-user-id')
        send('channel.add_member', { channel_id: state.currentChannelId, target_user_id: userId })
      })
    })
  },
  'channel.member_added': (msg) => {
    showToast('Member added successfully')
    dom.addMemberModal.close()
    dom.memberSearchInput.value = ''
    dom.memberSearchResults.innerHTML = ''
  },
  error: handleError
}

/**
 * Route incoming message to appropriate handler
 * @param {Object} msg - Message with type 't'
 */
const handleMessage = (msg) => {
  const handler = messageHandlers[msg.t]
  if (handler) {
    Promise.resolve(handler(msg)).catch((error) => {
      console.error('Client message handler failed', msg?.t, error)
      showToast('Realtime handler error. Retrying may help.')
    })
  }
}

/**
 * Request list of channels from server
 */
const requestChannels = () => {
  send('channel.list', {})
}

/**
 * Apply local state updates after a hub is deleted
 * @param {{hub_id?: string}} body
 */
const applyHubDeleted = (body) => {
  const hubId = body.hub_id
  if (!hubId) {
    return
  }

  const removedChannelIds = new Set(
    state.channels.filter((channel) => channel.hub_id === hubId).map((channel) => channel.channel_id)
  )

  state.hubs = state.hubs.filter((hub) => hub.hub_id !== hubId)
  state.channels = state.channels.filter((channel) => channel.hub_id !== hubId)

  for (const channelId of removedChannelIds) {
    state.messages.delete(channelId)
    localStorage.removeItem(`channel:${channelId}:messages`)
  }

  if (state.currentChannelId && removedChannelIds.has(state.currentChannelId)) {
    const nextChannelId = state.channels[0]?.channel_id || null
    state.currentChannelId = null
    if (nextChannelId) {
      setActiveChannel(nextChannelId)
    } else {
      state.voiceActive = false
      leaveCurrentVoiceCall()
      dom.activeRoom.textContent = 'No channel selected'
      dom.messages.innerHTML = ''
      updateChannelLayoutMode()
      updateCallControls()
    }
  }

  renderChannels()
}

/**
 * Apply local state updates after a channel is deleted
 * @param {{channel_id?: string}} body
 */
const applyChannelDeleted = (body) => {
  const channelId = body.channel_id
  if (!channelId) {
    return
  }

  state.channels = state.channels.filter((channel) => channel.channel_id !== channelId)
  state.messages.delete(channelId)
  localStorage.removeItem(`channel:${channelId}:messages`)

  if (state.currentChannelId === channelId) {
    const nextChannelId = state.channels[0]?.channel_id || null
    state.currentChannelId = null
    if (nextChannelId) {
      setActiveChannel(nextChannelId)
    } else {
      state.voiceActive = false
      leaveCurrentVoiceCall()
      dom.activeRoom.textContent = 'No channel selected'
      dom.messages.innerHTML = ''
      updateChannelLayoutMode()
      updateCallControls()
    }
  }

  renderChannels()
}

// Channel creation modal listeners (hoisted for use in renderHubs)
function openCreateRoomModal(hubId = null) {
  state.selectedHubIdForChannelCreation = hubId
  dom.modalRoomName.value = ''
  dom.modalRoomKind.value = 'text'
  dom.modalRoomVisibility.value = 'public'
  // Populate hub selector
  dom.modalHubSelect.innerHTML = '<option value="">Select a hub</option>'
  state.hubs.forEach(hub => {
    const option = document.createElement('option')
    option.value = hub.hub_id
    option.textContent = hub.name
    if (hub.hub_id === hubId) {
      option.selected = true
    }
    dom.modalHubSelect.appendChild(option)
  })
  // If hubId was provided, disable the selector (it's pre-selected)
  if (hubId) {
    dom.modalHubSelect.disabled = true
  } else {
    dom.modalHubSelect.disabled = false
  }
  dom.createRoomModal.showModal()
  dom.modalRoomName.focus()
}

/**
 * Render channel list in sidebar
 */
/**
 * Render hubs with nested channels
 */
const renderHubs = () => {
  dom.hubsList.innerHTML = ''
  
  if (state.hubs.length === 0) {
    const emptyMsg = document.createElement('li')
    emptyMsg.className = 'empty-message'
    emptyMsg.textContent = 'No hubs yet. Create one!'
    dom.hubsList.appendChild(emptyMsg)
    return
  }
  
  state.hubs.forEach(hub => {
    const hubItem = document.createElement('li')
    hubItem.className = 'hub-item'
    
    const hubHeader = document.createElement('div')
    hubHeader.className = 'hub-header'
    
    const hubName = document.createElement('span')
    hubName.className = 'hub-name'
    hubName.textContent = hub.name
    hubName.title = 'Double-click to edit'
    
    // Double-click to edit hub name
    hubName.addEventListener('dblclick', (e) => {
      e.stopPropagation()
      startEditingHubName(hub, hubName)
    })
    
    const addChannelBtn = document.createElement('button')
    addChannelBtn.className = 'add-channel-btn'
    addChannelBtn.textContent = '+'
    addChannelBtn.title = `Add channel to ${hub.name}`
    addChannelBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      openCreateRoomModal(hub.hub_id)
    })

    const deleteHubBtn = document.createElement('button')
    deleteHubBtn.className = 'add-channel-btn delete-btn'
    deleteHubBtn.textContent = '🗑'
    deleteHubBtn.title = `Delete hub ${hub.name}`
    deleteHubBtn.setAttribute('aria-label', `Delete hub ${hub.name}`)
    deleteHubBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      const confirmed = window.confirm(`Delete hub "${hub.name}" and all its channels?`)
      if (!confirmed) {
        return
      }
      send('hub.delete', { hub_id: hub.hub_id })
    })

    const hubActions = document.createElement('div')
    hubActions.className = 'hub-actions'
    hubActions.appendChild(addChannelBtn)
    hubActions.appendChild(deleteHubBtn)
    
    hubHeader.appendChild(hubName)
    hubHeader.appendChild(hubActions)
    hubItem.appendChild(hubHeader)
    
    // Get channels for this hub
    const hubChannels = state.channels.filter(c => c.hub_id === hub.hub_id)
    
    if (hubChannels.length > 0) {
      const channelsList = document.createElement('ul')
      channelsList.className = 'channels-list'
      
      hubChannels.forEach(channel => {
        const channelItem = document.createElement('li')
        channelItem.className = 'channel-item'
        // Always show an icon for clarity
        const kindIcon = channel.kind === 'voice' ? '🔊' : '#'
        const visibilityIcon = channel.visibility === 'public' ? '🌍' : '🔒'
        const icon = `${kindIcon} ${visibilityIcon}`
        channelItem.innerHTML = ''
        const channelName = document.createElement('span')
        channelName.textContent = `${icon} ${channel.name}`
        channelName.title = 'Click to join, double-click to edit'
        channelName.style.flex = '1'
        if (channel.channel_id === state.currentChannelId) {
          channelItem.classList.add('active')
        }
        // Distinguish single vs double click
        let clickTimer = null
        channelName.addEventListener('click', (e) => {
          if (clickTimer) {
            clearTimeout(clickTimer)
            clickTimer = null
            return
          }
          clickTimer = setTimeout(() => {
            setActiveChannel(channel.channel_id)
            clickTimer = null
          }, 250)
        })
        channelName.addEventListener('dblclick', (e) => {
          e.stopPropagation()
          if (clickTimer) {
            clearTimeout(clickTimer)
            clickTimer = null
          }
          startEditingChannelName(channel, channelName, icon)
        })
        const deleteChannelBtn = document.createElement('button')
        deleteChannelBtn.className = 'channel-delete-btn'
        deleteChannelBtn.textContent = '🗑'
        deleteChannelBtn.title = `Delete channel ${channel.name}`
        deleteChannelBtn.setAttribute('aria-label', `Delete channel ${channel.name}`)
        deleteChannelBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          const confirmed = window.confirm(`Delete channel "${channel.name}"?`)
          if (!confirmed) {
            return
          }
          send('channel.delete', { channel_id: channel.channel_id })
        })
        channelItem.appendChild(channelName)
        channelItem.appendChild(deleteChannelBtn)
        channelsList.appendChild(channelItem)
      })
      
      hubItem.appendChild(channelsList)
    }
    
    dom.hubsList.appendChild(hubItem)
  })
}

/**
 * Start editing a hub name inline
 * @param {Object} hub - Hub object
 * @param {HTMLElement} hubNameElement - Element containing hub name
 */
const startEditingHubName = (hub, hubNameElement) => {
  const originalName = hub.name
  const input = document.createElement('input')
  input.type = 'text'
  input.value = originalName
  input.className = 'inline-edit-input hub-edit-input'
  
  const saveEdit = () => {
    const newName = input.value.trim()
    if (newName && newName !== originalName) {
      send('hub.update', { hub_id: hub.hub_id, name: newName })
    }
    hubNameElement.textContent = originalName
    hubNameElement.style.display = ''
    input.remove()
  }
  
  const cancelEdit = () => {
    hubNameElement.style.display = ''
    input.remove()
  }
  
  input.addEventListener('blur', saveEdit)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  })
  
  hubNameElement.style.display = 'none'
  hubNameElement.parentElement.insertBefore(input, hubNameElement)
  input.focus()
  input.select()
}

/**
 * Start editing a channel name inline
 * @param {Object} channel - Channel object
 * @param {HTMLElement} channelNameElement - Element containing channel name
 * @param {string} icon - Channel visibility icon
 */
const startEditingChannelName = (channel, channelNameElement, icon) => {
  const originalName = channel.name
  const input = document.createElement('input')
  input.type = 'text'
  input.value = originalName
  input.className = 'inline-edit-input channel-edit-input'
  
  const saveEdit = () => {
    const newName = input.value.trim()
    if (newName && newName !== originalName) {
      send('channel.update', { channel_id: channel.channel_id, name: newName })
    }
    channelNameElement.textContent = `${icon} ${originalName}`
    channelNameElement.style.display = ''
    input.remove()
  }
  
  const cancelEdit = () => {
    channelNameElement.style.display = ''
    input.remove()
  }
  
  input.addEventListener('blur', saveEdit)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  })
  
  channelNameElement.style.display = 'none'
  channelNameElement.parentElement.insertBefore(input, channelNameElement)
  console.info('Starting to edit channel name for channel:', channel, channelNameElement.parentElement)

  input.focus()
  input.select()
}

const renderChannels = renderHubs

const leaveCurrentVoiceCall = () => {
  if (!state.callId) {
    return
  }
  if (state.selfPeerId) {
    send('rtc.leave', { call_id: state.callId, peer_id: state.selfPeerId })
  }
  teardownCall()
}

const ensureVoiceStateForChannel = (channelId) => {
  if (!isVoiceChannel(channelId)) {
    // Keep current voice session alive while browsing text channels.
    // A voice session only resets when switching to a different voice channel.
    return
  }

  state.voiceActive = true
  if (state.callId && state.callChannelId === channelId) {
    updateCallControls()
    return
  }

  if (state.callId && state.callChannelId !== channelId) {
    leaveCurrentVoiceCall()
  }

  const existingCall = state.channelCallMap.get(channelId)
  if (existingCall) {
    state.callId = existingCall
    state.callChannelId = channelId
    send('rtc.join', { call_id: existingCall, peer_meta: { device: 'browser', capabilities: { screen: true } } })
  } else {
    send('rtc.call_create', { channel_id: channelId, kind: 'mesh', media: { audio: true, video: true } })
  }
  updateCallControls()
}

/**
 * Set active channel and load message history
 * @param {string} channelId
 */
const setActiveChannel = (channelId) => {
  state.currentChannelId = channelId
  updateChannelLayoutMode()
  dom.activeRoom.textContent = state.channels.find((channel) => channel.channel_id === channelId)?.name || channelId
  renderChannels()
  const cached = loadCachedMessages(channelId)
  if (cached) {
    state.messages.set(channelId, cached)
    renderMessages(channelId)
  }
  send('channel.join', { channel_id: channelId })
  ensureVoiceStateForChannel(channelId)
  updateCallControls()
  setSidebarMenuOpen(false)
}

/**
 * Add message to channel message list and render if active channel
 * @param {string} channelId
 * @param {Object} msg - Message object
 */
const addMessage = (channelId, msg) => {
  if (!state.messages.has(channelId)) {
    state.messages.set(channelId, [])
  }
  state.messages.get(channelId).push(msg)
  if (channelId === state.currentChannelId) {
    renderMessages(channelId)
  }
  cacheMessages(channelId)
}

/**
 * Render all messages for current channel
 * @param {string} channelId
 */
const renderMessages = (channelId) => {
  if (channelId !== state.currentChannelId) {
    return
  }
  const list = state.messages.get(channelId) || []
  dom.messages.innerHTML = ''
  list.forEach((msg) => {
    const item = document.createElement('div')
    item.className = 'message'
    const meta = document.createElement('div')
    meta.className = 'meta'
    const handle = msg.user_handle || msg.user_id
    meta.textContent = `${handle} · ${new Date(msg.ts).toLocaleTimeString()}`
    const text = document.createElement('div')
    text.textContent = msg.text
    item.appendChild(meta)
    item.appendChild(text)
    dom.messages.appendChild(item)
  })
  dom.messages.scrollTop = dom.messages.scrollHeight
}

/**
 * Render search results
 * @param {Array<Object>} hits - Search hit results
 */
const renderSearch = (hits) => {
  if (!hits.length) {
    dom.searchResults.textContent = 'No results'
    return
  }
  dom.searchResults.textContent = hits.map((hit) => hit.snippet || hit.text).join(' | ')
}

/**
 * Cache messages for a channel to localStorage (last 50 messages)
 * @param {string} channelId
 */
const cacheMessages = (channelId) => {
  const list = state.messages.get(channelId) || []
  const trimmed = list.slice(-50)
  localStorage.setItem(`channel:${channelId}:messages`, JSON.stringify(trimmed))
}

/**
 * Load cached messages from localStorage
 * @param {string} channelId
 * @returns {Array<Object>|null}
 */
const loadCachedMessages = (channelId) => {
  const raw = localStorage.getItem(`channel:${channelId}:messages`)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw)
  } catch (error) {
    return null
  }
}

/**
 * Update UI state for voice call controls
 */
const updateCallControls = () => {
  const inVoiceChannel = isVoiceChannel(state.currentChannelId)
  const inActiveVoiceCall = Boolean(state.callId && state.callChannelId === state.currentChannelId)

  dom.startCallBtn.disabled = !inVoiceChannel || !inActiveVoiceCall
  dom.toggleMediaBtn.disabled = !inActiveVoiceCall
  dom.shareScreenBtn.disabled = !inActiveVoiceCall
  dom.hangupCallBtn.disabled = !state.callId

  dom.startCallBtn.textContent = state.micMuted ? '🔇' : '🎤'
  dom.startCallBtn.title = state.micMuted ? 'Unmute microphone' : 'Mute microphone'
  dom.toggleMediaBtn.textContent = state.videoStream ? '📕' : '📷'
  dom.toggleMediaBtn.title = state.videoStream ? 'Turn camera off' : 'Turn camera on'
  dom.shareScreenBtn.textContent = state.screenStream ? '🛑' : '🖥'
  dom.shareScreenBtn.title = state.screenStream ? 'Stop screen share' : 'Start screen share'

  if (!inVoiceChannel) {
    dom.voiceHint.textContent = 'Select a voice channel to join live audio'
  } else if (!inActiveVoiceCall) {
    dom.voiceHint.textContent = 'Connecting to voice channel...'
  } else {
    dom.voiceHint.textContent = state.micMuted
      ? 'In voice. You are muted'
      : 'In voice. Mic is live'
  }

  if (dom.streamsEmpty) {
    dom.streamsEmpty.classList.toggle('hidden', dom.streams.children.length > 0)
  }
}

/**
 * Ensure peer connections exist for all peers in a call
 * @param {Array<Object>} peers
 */
const ensurePeers = (peers) => {
  peers.forEach((peer) => {
    if (peer.peer_id === state.selfPeerId) {
      return
    }
    createPeerConnection(peer.peer_id)
    negotiatePeer(peer.peer_id)
  })
}

/**
 * Build ICE server configuration from state
 * @returns {Array<Object>}
 */
const buildIceServers = () => {
  if (!state.ice) {
    return []
  }
  const servers = []
  if (state.ice.stun_urls?.length) {
    servers.push({ urls: state.ice.stun_urls })
  }
  if (state.ice.turn_urls?.length) {
    servers.push({ urls: state.ice.turn_urls, username: state.ice.turn_username, credential: state.ice.turn_credential })
  }
  return servers
}

/**
 * Create or retrieve RTCPeerConnection for a peer
 * @param {string} peerId
 * @returns {RTCPeerConnection}
 */
const createPeerConnection = (peerId) => {
  if (state.peerConnections.has(peerId)) {
    return state.peerConnections.get(peerId)
  }
  const pc = new RTCPeerConnection({ iceServers: buildIceServers() })
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      rtcInfo('[RTC] local ICE candidate', {
        toPeerId: peerId,
        type: event.candidate.type || null
      })
      send('rtc.ice', {
        call_id: state.callId,
        to_peer_id: peerId,
        from_peer_id: state.selfPeerId,
        candidate: event.candidate
      })
    }
  }
  pc.ontrack = (event) => {
    const stream = getOrCreateInboundStream(event, peerId)
    rtcInfo('[RTC] ontrack', {
      peerId,
      trackKind: event.track?.kind || null,
      streamId: stream?.id || null,
      videoTracks: stream?.getVideoTracks().length || 0,
      audioTracks: stream?.getAudioTracks().length || 0
    })
    if (stream) {
      if (stream.getVideoTracks().length === 0) {
        ensureRemoteAudio(stream, peerId)
        return
      }
      addStreamTile(stream, `${peerId}`, false, peerId)
      ensureRemoteAudio(stream, peerId)
    }
  }
  pc.onconnectionstatechange = () => {
    rtcInfo('[RTC] connection state', {
      peerId,
      state: pc.connectionState
    })
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      closePeer(peerId)
    }
  }
  pc.oniceconnectionstatechange = () => {
    rtcInfo('[RTC] ice connection state', {
      peerId,
      state: pc.iceConnectionState
    })
    if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
      closePeer(peerId)
    }
  }
  state.peerConnections.set(peerId, pc)
  return pc
}

/**
 * Get a remote stream from the event or synthesize one for streamless track events.
 * @param {RTCTrackEvent} event
 * @param {string} peerId
 * @returns {MediaStream|null}
 */
const getOrCreateInboundStream = (event, peerId) => {
  const signaledStream = event.streams?.[0]
  if (signaledStream) {
    state.remoteInboundStreamsByPeer.set(peerId, signaledStream)
    return signaledStream
  }
  if (!event.track) {
    return null
  }
  const existing = state.remoteInboundStreamsByPeer.get(peerId)
  if (existing) {
    const hasTrack = existing.getTracks().some((track) => track.id === event.track.id)
    if (!hasTrack) {
      existing.addTrack(event.track)
    }
    return existing
  }
  const synthetic = new MediaStream([event.track])
  state.remoteInboundStreamsByPeer.set(peerId, synthetic)
  return synthetic
}

/**
 * Ensure each peer connection can receive audio and video even before local capture starts.
 * @param {RTCPeerConnection} pc
 */
const ensureRecvTransceivers = (pc) => {
  const hasAudioReceiver = pc.getTransceivers().some((transceiver) => transceiver.receiver?.track?.kind === 'audio')
  const hasVideoReceiver = pc.getTransceivers().some((transceiver) => transceiver.receiver?.track?.kind === 'video')
  if (!hasAudioReceiver) {
    pc.addTransceiver('audio', { direction: 'recvonly' })
  }
  if (!hasVideoReceiver) {
    pc.addTransceiver('video', { direction: 'recvonly' })
  }
}

const attachTrackToPeerConnection = async (pc, track, stream) => {
  const hasTrack = pc.getSenders().some((sender) => sender.track?.id === track.id)
  if (hasTrack) {
    return
  }

  // Prefer reusing offered recvonly transceivers so answerers can actually send media.
  const reusable = pc.getTransceivers().find((transceiver) => (
    transceiver.receiver?.track?.kind === track.kind && !transceiver.sender?.track
  ))

  if (reusable?.sender) {
    if (reusable.direction === 'recvonly') {
      reusable.direction = 'sendrecv'
    } else if (reusable.direction === 'inactive') {
      reusable.direction = 'sendonly'
    }
    await reusable.sender.replaceTrack(track).catch(() => {
      pc.addTrack(track, stream)
    })
    return
  }

  pc.addTrack(track, stream)
}

/**
 * Attach all active local media tracks to a peer connection
 * @param {RTCPeerConnection} pc
 */
const attachLocalTracks = async (pc) => {
  const attachPromises = []
  if (state.audioStream) {
    state.audioStream.getTracks().forEach((track) => {
      attachPromises.push(attachTrackToPeerConnection(pc, track, state.audioStream))
    })
  }
  if (state.videoStream) {
    state.videoStream.getTracks().forEach((track) => {
      attachPromises.push(attachTrackToPeerConnection(pc, track, state.videoStream))
    })
  }
  if (state.screenStream) {
    state.screenStream.getTracks().forEach((track) => {
      attachPromises.push(attachTrackToPeerConnection(pc, track, state.screenStream))
    })
  }
  await Promise.all(attachPromises)
}

/**
 * Initiate offer negotiation with a peer
 * @param {string} peerId
 */
const negotiatePeer = async (peerId) => {
  const pc = createPeerConnection(peerId)
  ensureRecvTransceivers(pc)
  await attachLocalTracks(pc)
  rtcInfo('[RTC] creating offer', {
    toPeerId: peerId,
    senderTracks: pc.getSenders().map((sender) => sender.track?.kind || 'none')
  })
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  rtcInfo('[RTC] offer created', {
    toPeerId: peerId,
    callId: state.callId,
    media: summarizeSdpMedia(offer.sdp)
  })
  send('rtc.offer', {
    call_id: state.callId,
    to_peer_id: peerId,
    from_peer_id: state.selfPeerId,
    sdp: offer.sdp
  })
}

/**
 * Close and remove peer connection
 * @param {string} peerId
 */
const closePeer = (peerId) => {
  const pc = state.peerConnections.get(peerId)
  if (pc) {
    pc.close()
  }
  state.peerConnections.delete(peerId)
  state.remoteInboundStreamsByPeer.delete(peerId)

  for (const [streamId, tile] of state.streamTiles.entries()) {
    if (tile.dataset.peerId === peerId) {
      tile.remove()
      state.streamTiles.delete(streamId)
    }
  }
  for (const [streamId, audioEl] of state.remoteAudioEls.entries()) {
    if (audioEl.dataset.peerId === peerId) {
      audioEl.srcObject = null
      audioEl.remove()
      state.remoteAudioEls.delete(streamId)
    }
  }
  updateCallControls()
}

const ensureRemoteAudio = (stream, ownerPeerId) => {
  if (!stream.getAudioTracks().length) {
    return
  }
  if (state.remoteAudioEls.has(stream.id)) {
    return
  }
  const audio = document.createElement('audio')
  audio.autoplay = true
  audio.muted = false
  audio.srcObject = stream
  audio.dataset.peerId = ownerPeerId
  audio.style.display = 'none'
  document.body.appendChild(audio)
  audio.play().catch(() => {})
  state.remoteAudioEls.set(stream.id, audio)

  const cleanupIfEnded = () => {
    const hasLiveAudio = stream.getAudioTracks().some((track) => track.readyState === 'live')
    if (!hasLiveAudio) {
      audio.srcObject = null
      audio.remove()
      state.remoteAudioEls.delete(stream.id)
    }
  }
  stream.getAudioTracks().forEach((track) => {
    track.addEventListener('ended', cleanupIfEnded)
  })
  stream.addEventListener('addtrack', (event) => {
    if (event.track?.kind === 'audio') {
      event.track.addEventListener('ended', cleanupIfEnded)
    }
  })
  stream.addEventListener('removetrack', (event) => {
    if (!event.track || event.track.kind === 'audio') {
      cleanupIfEnded()
    }
  })
  stream.addEventListener('inactive', cleanupIfEnded)
}

/**
 * Add a media stream tile to the grid
 * @param {MediaStream} stream
 * @param {string} label - Display label
 * @param {boolean} isLocal - Whether this is local or remote stream
 */
const addStreamTile = (stream, label, isLocal, ownerPeerId = null) => {
  if (ownerPeerId) {
    for (const [existingStreamId, existingTile] of state.streamTiles.entries()) {
      if (existingStreamId === stream.id || existingTile.dataset.peerId !== ownerPeerId) {
        continue
      }
      const existingVideo = existingTile.querySelector('video')
      const existingStream = existingVideo?.srcObject
      const hasLiveVideo = !!existingStream?.getVideoTracks().some((track) => track.readyState === 'live')
      if (!hasLiveVideo) {
        existingTile.remove()
        state.streamTiles.delete(existingStreamId)
      }
    }
  }

  if (state.streamTiles.has(stream.id)) {
    rtcInfo('[RTC] stream tile exists', {
      streamId: stream.id,
      ownerPeerId,
      isLocal
    })
    return
  }
  const tile = document.createElement('div')
  tile.className = 'stream-tile'
  if (ownerPeerId) {
    tile.dataset.peerId = ownerPeerId
  }
  const video = document.createElement('video')
  video.autoplay = true
  video.muted = isLocal
  video.playsInline = true
  video.srcObject = stream
  video.play().catch(() => {})
  const caption = document.createElement('div')
  caption.className = 'stream-label'
  caption.textContent = isLocal ? `${label} (you)` : label
  tile.appendChild(video)
  tile.appendChild(caption)
  dom.streams.appendChild(tile)
  state.streamTiles.set(stream.id, tile)
  rtcInfo('[RTC] stream tile added', {
    streamId: stream.id,
    ownerPeerId,
    isLocal,
    tiles: state.streamTiles.size
  })

  const cleanupIfEnded = () => {
    const hasLiveVideo = stream.getVideoTracks().some((track) => track.readyState === 'live')
    if (!hasLiveVideo) {
      removeStreamTile(stream)
    }
  }
  stream.getVideoTracks().forEach((track) => {
    track.addEventListener('ended', cleanupIfEnded)
  })
  stream.addEventListener('addtrack', (event) => {
    if (event.track?.kind === 'video') {
      event.track.addEventListener('ended', cleanupIfEnded)
    }
  })
  stream.addEventListener('removetrack', (event) => {
    if (!event.track || event.track.kind === 'video') {
      cleanupIfEnded()
    }
  })
  stream.addEventListener('inactive', cleanupIfEnded)

  updateCallControls()
}

/**
 * Remove a stream tile from the grid
 * @param {MediaStream} stream
 */
const removeStreamTile = (stream) => {
  const tile = state.streamTiles.get(stream.id)
  if (tile) {
    tile.remove()
    state.streamTiles.delete(stream.id)
    rtcInfo('[RTC] stream tile removed', {
      streamId: stream.id,
      tiles: state.streamTiles.size
    })
    updateCallControls()
  }
}

/**
 * Start audio capture (microphone)
 */
const startAudio = async () => {
  if (state.audioStream) {
    return
  }
  try {
    state.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  } catch (error) {
    state.micMuted = true
    showToast('Microphone access was denied')
    updateCallControls()
    return
  }
  state.audioStream.getAudioTracks().forEach((track) => {
    track.enabled = !state.micMuted
  })
  state.peerConnections.forEach((pc, peerId) => {
    negotiatePeer(peerId)
  })
  updateCallControls()
}

/**
 * Stop audio capture
 */
const stopAudio = () => {
  if (!state.audioStream) {
    return
  }
  state.audioStream.getTracks().forEach((track) => track.stop())
  state.audioStream = null
  state.micMuted = false
  updateCallControls()
}

const toggleMicMute = () => {
  if (!state.callId || !state.audioStream) {
    return
  }
  state.micMuted = !state.micMuted
  state.audioStream.getAudioTracks().forEach((track) => {
    track.enabled = !state.micMuted
  })
  updateCallControls()
}

/**
 * Start video capture (camera)
 */
const startVideo = async () => {
  if (state.videoStream) {
    stopVideo()
    return
  }
  try {
    state.videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 }, audio: false })
  } catch (error) {
    showToast('Camera access was denied')
    updateCallControls()
    return
  }
  addStreamTile(state.videoStream, 'Camera', true, 'local')
  notifyStreamPublish('cam', 'camera', 'Camera', state.videoStream)
  state.peerConnections.forEach((pc, peerId) => {
    negotiatePeer(peerId)
  })
  updateCallControls()
}

/**
 * Stop video capture
 */
const stopVideo = () => {
  if (!state.videoStream) {
    return
  }
  state.videoStream.getTracks().forEach((track) => track.stop())
  removeStreamTile(state.videoStream)
  state.videoStream = null
  updateCallControls()
}

/**
 * Start screen capture for sharing
 */
const startScreenShare = async () => {
  if (state.screenStream) {
    stopScreenShare()
    return
  }
  if (!navigator.mediaDevices?.getDisplayMedia) {
    showToast('Screen share is not supported on this device/browser')
    return
  }
  try {
    state.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
  } catch (error) {
    showToast('Screen share was cancelled or denied')
    updateCallControls()
    return
  }
  addStreamTile(state.screenStream, 'Screen', true, 'local')
  notifyStreamPublish('screen', 'screen', 'Screen', state.screenStream)
  state.peerConnections.forEach((pc, peerId) => {
    negotiatePeer(peerId)
  })
  updateCallControls()
  state.screenStream.getVideoTracks()[0].addEventListener('ended', () => {
    stopScreenShare()
  })
}

/**
 * Stop screen capture
 */
const stopScreenShare = () => {
  if (!state.screenStream) {
    return
  }
  state.screenStream.getTracks().forEach((track) => track.stop())
  removeStreamTile(state.screenStream)
  state.screenStream = null
  updateCallControls()
}

/**
 * Notify peers of a published stream
 * @param {string} streamId
 * @param {string} kind
 * @param {string} label
 * @param {MediaStream} stream
 */
const notifyStreamPublish = (streamId, kind, label, stream) => {
  if (!state.callId || !state.selfPeerId) {
    return
  }
  send('rtc.stream_publish', {
    call_id: state.callId,
    peer_id: state.selfPeerId,
    stream: {
      stream_id: streamId,
      kind,
      label,
      tracks: { audio: stream.getAudioTracks().length > 0, video: stream.getVideoTracks().length > 0 }
    }
  })
}

/**
 * Tear down all peer connections and media streams when leaving a call
 */
const teardownCall = () => {
  state.peerConnections.forEach((pc) => pc.close())
  state.peerConnections.clear()
  state.remoteAudioEls.forEach((audioEl) => {
    audioEl.srcObject = null
    audioEl.remove()
  })
  state.remoteAudioEls.clear()
  state.remoteInboundStreamsByPeer.clear()
  state.pendingIceByPeer.clear()
  state.streamTiles.forEach((tile) => tile.remove())
  state.streamTiles.clear()
  state.callId = null
  state.callChannelId = null
  state.selfPeerId = null
  stopAudio()
  stopVideo()
  stopScreenShare()
  state.voiceActive = false
  updateCallControls()
}

/**
 * Set up all event listeners for UI interactions
 */
const setupEventListeners = () => {
  dom.mobileMenuBtn.addEventListener('click', () => {
    setSidebarMenuOpen(!state.sidebarMenuOpen)
  })

  dom.sidebarOverlay.addEventListener('click', () => {
    setSidebarMenuOpen(false)
  })

  window.addEventListener('resize', () => {
    setSidebarMenuOpen(state.sidebarMenuOpen)
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setSidebarMenuOpen(false)
      setTextChatDrawerOpen(false)
    }
  })

  dom.textChatToggle.addEventListener('click', () => {
    setTextChatDrawerOpen(!state.textChatDrawerOpen)
  })

  dom.textChatClose.addEventListener('click', () => {
    setTextChatDrawerOpen(false)
  })

  // Auth tab switching
  dom.signupTab.addEventListener('click', () => {
    dom.signupTab.classList.add('active')
    dom.signinTab.classList.remove('active')
    dom.signupForm.classList.add('active')
    dom.signinForm.classList.remove('active')
  })

  dom.signinTab.addEventListener('click', () => {
    dom.signinTab.classList.add('active')
    dom.signupTab.classList.remove('active')
    dom.signinForm.classList.add('active')
    dom.signupForm.classList.remove('active')
  })

  // Sign up listener (with invite token + password)
  dom.redeemBtn.addEventListener('click', () => {
    const inviteToken = dom.inviteInput.value.trim()
    const handle = dom.handleInput.value.trim()
    const password = dom.signupPasswordInput.value.trim()

    if (!inviteToken || !handle || !password) {
      dom.authHint.textContent = 'Please fill in all fields'
      return
    }

    dom.authHint.textContent = 'Signing up...'
    sendAuthRequest('auth.invite_redeem', {
      invite_token: inviteToken,
      profile: { handle, display_name: handle },
      password
    })
  })

  // Sign in listener (with username/password)
  dom.signinBtn.addEventListener('click', () => {
    const handle = dom.signinHandleInput.value.trim()
    const password = dom.signinPasswordInput.value.trim()

    if (!handle || !password) {
      dom.signinHint.textContent = 'Please enter username and password'
      return
    }

    dom.signinHint.textContent = 'Signing in...'
    sendAuthRequest('auth.signin', { handle, password })
  })

  // Allow Enter key to submit in signup form
  dom.signupPasswordInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      dom.redeemBtn.click()
    }
  })

  // Allow Enter key to submit in signin form
  dom.signinPasswordInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      dom.signinBtn.click()
    }
  })

  // Logout listener
  dom.logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('session_token')
    state.user = null
    state.sessionToken = null
    setAuthUi()
    showToast('Signed out')
  })

  // Admin invite listeners
  const createAdminInvite = () => {
    send('admin.invite_create', { ttl_ms: 24 * 60 * 60 * 1000, max_uses: 1, note: 'web invite' })
  }
  dom.createAdminInviteBtn.addEventListener('click', createAdminInvite)
  dom.createAdminInviteSideBtn.addEventListener('click', createAdminInvite)

  // Hub creation listeners
  const openCreateHubModal = () => {
    dom.modalHubName.value = ''
    dom.modalHubDescription.value = ''
    dom.modalHubVisibility.value = 'public'
    dom.createHubModal.showModal()
    dom.modalHubName.focus()
  }

  const closeCreateHubModal = () => {
    dom.createHubModal.close()
  }

  const submitCreateHub = () => {
    const name = dom.modalHubName.value.trim()
    const description = dom.modalHubDescription.value.trim() || null
    const visibility = dom.modalHubVisibility.value
    if (!name) {
      return
    }
    send('hub.create', { name, description, visibility })
    // Modal will close when hub.created message is received
  }

  dom.createHubBtn.addEventListener('click', openCreateHubModal)
  dom.closeCreateHubModalBtn.addEventListener('click', closeCreateHubModal)
  dom.modalHubCancelBtn.addEventListener('click', closeCreateHubModal)
  dom.modalCreateHubBtn.addEventListener('click', submitCreateHub)

  dom.modalHubName.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submitCreateHub()
    }
  })

  dom.createHubModal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeCreateHubModal()
    }
  })

  const closeCreateRoomModal = () => {
    dom.createRoomModal.close()
    state.selectedHubIdForChannelCreation = null
  }

  const submitCreateRoom = () => {
    const name = dom.modalRoomName.value.trim()
    const kind = dom.modalRoomKind.value
    const visibility = dom.modalRoomVisibility.value
    const hubId = state.selectedHubIdForChannelCreation || dom.modalHubSelect.value
    
    if (!name) {
      showToast('Please enter a channel name')
      return
    }
    
    if (!hubId) {
      showToast('Please select a hub')
      return
    }
    
    send('channel.create', { hub_id: hubId, kind, name, visibility })
    closeCreateRoomModal()
  }

  // Note: openCreateRoomModalBtn no longer exists in HTML, modal is opened via hub + buttons
  dom.closeCreateRoomModalBtn.addEventListener('click', closeCreateRoomModal)
  dom.modalCancelBtn.addEventListener('click', closeCreateRoomModal)
  dom.modalCreateRoomBtn.addEventListener('click', submitCreateRoom)

  // Allow Enter key to submit in modal
  dom.modalRoomName.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submitCreateRoom()
    }
  })

  // Close modal on Escape key
  dom.createRoomModal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeCreateRoomModal()
    }
  })

  // Add member modal listeners
  const openAddMemberModal = () => {
    if (!state.currentChannelId) {
      showToast('No channel selected')
      return
    }
    dom.memberSearchInput.value = ''
    dom.memberSearchResults.innerHTML = ''
    dom.addMemberModal.showModal()
    dom.memberSearchInput.focus()
  }

  const closeAddMemberModal = () => {
    dom.addMemberModal.close()
  }

  dom.addMemberBtn.addEventListener('click', openAddMemberModal)
  dom.closeAddMemberModalBtn.addEventListener('click', closeAddMemberModal)
  dom.closeAddMemberBtn.addEventListener('click', closeAddMemberModal)

  dom.memberSearchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      const query = dom.memberSearchInput.value.trim()
      if (query) {
        send('user.search', { q: query, limit: 10 })
      }
    }
  })

  dom.addMemberModal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAddMemberModal()
    }
  })

  // Message listeners
  dom.sendMessageBtn.addEventListener('click', () => {
    const text = dom.messageInput.value.trim()
    if (!text || !state.currentChannelId) {
      return
    }
    dom.messageInput.value = ''
    send('msg.send', {
      channel_id: state.currentChannelId,
      client_msg_id: `local-${Date.now()}`,
      text
    })
  })

  dom.messageInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return
    }
    event.preventDefault()
    dom.sendMessageBtn.click()
  })

  // Search listener
  dom.searchBtn.addEventListener('click', () => {
    const q = dom.searchInput.value.trim()
    if (!q || !state.currentChannelId) {
      return
    }
    send('search.query', { scope: { kind: 'channel', channel_id: state.currentChannelId }, q, limit: 20 })
  })

  // Voice and media listeners
  dom.startCallBtn.addEventListener('click', () => {
    toggleMicMute()
  })

  dom.hangupCallBtn.addEventListener('click', () => {
    leaveCurrentVoiceCall()
  })

  dom.toggleMediaBtn.addEventListener('click', () => {
    if (!state.callId) {
      return
    }
    if (state.videoStream) {
      stopVideo()
    } else {
      startVideo()
    }
  })

  dom.shareScreenBtn.addEventListener('click', () => {
    if (!state.callId) {
      return
    }
    if (state.screenStream) {
      stopScreenShare()
    } else {
      startScreenShare()
    }
  })
}

// Initialize app
setupEventListeners()
ensureRtcDebugPanel()
if (rtcDebugEnabled) {
  rtcInfo('[RTC] debug session started', { href: location.href })
}
updateCallControls()
renderMobileDiagnostics()
connect()
