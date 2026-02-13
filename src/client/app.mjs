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
  channelCallMap: new Map(),
  toastTimer: null,
  voiceActive: false
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
  layout: qs('.layout'),
  adminPanel: qs('#admin-panel'),
  hubsList: qs('#hubs-list'),
  activeRoom: qs('#active-room'),
  messages: qs('#messages'),
  searchResults: qs('#search-results'),
  streams: qs('#streams'),
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

/**
 * Set connection status text
 * @param {string} text
 */
const setStatus = (text) => {
  dom.status.textContent = text
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
    showToast('Signed in. Create a channel or invite someone')
  } else {
    dom.userPill.textContent = 'signed out'
    dom.logoutBtn.classList.add('hidden')
    dom.authCard.classList.remove('hidden')
    dom.layout.classList.add('hidden')
    dom.adminPanel.classList.add('hidden')
  }
}

/**
 * Send a message to the server
 * @param {string} messageType - Message type identifier
 * @param {Object} body - Message payload
 */
const send = (messageType, body) => {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    const message = 'Connection not ready. Please wait...'
    dom.authHint.textContent = message
    dom.signinHint.textContent = message
    showToast(message)
    return
  }
  state.ws.send(JSON.stringify({ v: 1, t: messageType, id: `${messageType}-${Date.now()}`, ts: Date.now(), body }))
}

/**
 * Establish WebSocket connection to server
 */
const connect = () => {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  state.ws = new WebSocket(`${protocol}://${location.host}/ws`)

  state.ws.addEventListener('open', () => {
    setStatus('connected')
    send('hello', {
      client: { name: 'hubot-chat-p2p-web', ver: '0.1.0', platform: 'browser' },
      resume: { session_token: state.sessionToken }
    })
  })

  state.ws.addEventListener('close', () => {
    setStatus('disconnected')
  })

  state.ws.addEventListener('message', (event) => {
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
  if (msg.body?.message?.includes('Not a member') && state.currentChannelId) {
    send('channel.join', { channel_id: state.currentChannelId })
  }
}

/**
 * Handle incoming offer from peer
 * @param {Object} body - rtc.offer_event body
 */
const handleOffer = async (body) => {
  const pc = createPeerConnection(body.from_peer_id)
  await pc.setRemoteDescription({ type: 'offer', sdp: body.sdp })
  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)
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
  const pc = state.peerConnections.get(body.from_peer_id)
  if (!pc) {
    return
  }
  await pc.setRemoteDescription({ type: 'answer', sdp: body.sdp })
}

/**
 * Handle incoming ICE candidate from peer
 * @param {Object} body - rtc.ice_event body
 */
const handleIce = async (body) => {
  const pc = state.peerConnections.get(body.from_peer_id)
  if (!pc) {
    return
  }
  if (body.candidate) {
    await pc.addIceCandidate(body.candidate)
  }
}

/**
 * Handle peer join/leave events
 * @param {Object} body - rtc.peer_event body
 */
const handlePeerEvent = (body) => {
  if (body.kind === 'join' && body.peer?.peer_id && body.peer.peer_id !== state.selfPeerId) {
    createPeerConnection(body.peer.peer_id)
    negotiatePeer(body.peer.peer_id)
  }
  if (body.kind === 'leave' && body.peer?.peer_id) {
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
  error: handleError,
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
    state.hubs.push(msg.body.hub)
    showToast(`Hub "${msg.body.hub.name}" created successfully`)
    dom.createHubModal.close()
    renderHubs()
  },
  'hub.updated': (msg) => {
    const hubIndex = state.hubs.findIndex(h => h.hub_id === msg.body.hub.hub_id)
    if (hubIndex !== -1) {
      state.hubs[hubIndex] = msg.body.hub
      renderHubs()
      showToast(`Hub renamed to "${msg.body.hub.name}"`)
    }
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
    state.channels.push(msg.body.channel)
    renderChannels()
    setActiveChannel(msg.body.channel.channel_id)
    send('channel.join', { channel_id: msg.body.channel.channel_id })
  },
  'channel.updated': (msg) => {
    const channelIndex = state.channels.findIndex(c => c.channel_id === msg.body.channel.channel_id)
    if (channelIndex !== -1) {
      state.channels[channelIndex] = msg.body.channel
      renderChannels()
      if (msg.body.channel.channel_id === state.currentChannelId) {
        dom.activeRoom.textContent = msg.body.channel.name
      }
      showToast(`Channel renamed to "${msg.body.channel.name}"`)
    }
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
    state.selfPeerId = msg.body.self_peer_id
    ensurePeers(msg.body.peers || [])
    if (state.voiceActive) {
      startAudio()
    }
  },
  'rtc.peer_event': handlePeerEvent,
  'rtc.offer_event': handleOffer,
  'rtc.answer_event': handleAnswer,
  'rtc.ice_event': handleIce,
  'rtc.stream_event': () => {
    // stream events are informational
  },
  'rtc.call_end': (msg) => {
    state.channelCallMap.delete(msg.body.channel_id)
    teardownCall()
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
    handler(msg)
  }
}

/**
 * Request list of channels from server
 */
const requestChannels = () => {
  send('channel.list', {})
}

// Channel creation modal listeners (hoisted for use in renderHubs)
function openCreateRoomModal(hubId = null) {
  state.selectedHubIdForChannelCreation = hubId
  dom.modalRoomName.value = ''
  dom.modalRoomKind.value = 'public'
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
    
    hubHeader.appendChild(hubName)
    hubHeader.appendChild(addChannelBtn)
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
        const icon = channel.visibility === 'public' ? '🔓' : '🔒'
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
            send('channel.join', { channel_id: channel.channel_id })
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
        channelItem.appendChild(channelName)
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

/**
 * Set active channel and load message history
 * @param {string} channelId
 */
const setActiveChannel = (channelId) => {
  state.currentChannelId = channelId
  dom.activeRoom.textContent = state.channels.find((channel) => channel.channel_id === channelId)?.name || channelId
  renderChannels()
  const cached = loadCachedMessages(channelId)
  if (cached) {
    state.messages.set(channelId, cached)
    renderMessages(channelId)
  }
  send('channel.join', { channel_id: channelId })
  updateCallControls()
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
  const activeCallId = state.channelCallMap.get(state.currentChannelId)
  if (!state.callId && activeCallId) {
    dom.startCallBtn.textContent = 'Join voice'
  } else if (state.callId) {
    dom.startCallBtn.textContent = 'Leave voice'
  } else {
    dom.startCallBtn.textContent = 'Join voice'
  }
  dom.toggleMediaBtn.disabled = !state.callId
  dom.shareScreenBtn.disabled = !state.callId
  if (!state.callId) {
    dom.voiceHint.textContent = 'Join voice to enable video and screen share'
  } else {
    dom.voiceHint.textContent = 'In voice. You can start video or share your screen'
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
      send('rtc.ice', {
        call_id: state.callId,
        to_peer_id: peerId,
        from_peer_id: state.selfPeerId,
        candidate: event.candidate
      })
    }
  }
  pc.ontrack = (event) => {
    const stream = event.streams[0]
    if (stream) {
      addStreamTile(stream, `${peerId}`, false)
    }
  }
  state.peerConnections.set(peerId, pc)
  attachLocalTracks(pc)
  return pc
}

/**
 * Attach all active local media tracks to a peer connection
 * @param {RTCPeerConnection} pc
 */
const attachLocalTracks = (pc) => {
  const existing = new Set(pc.getSenders().map((sender) => sender.track?.id).filter(Boolean))
  if (state.audioStream) {
    state.audioStream.getTracks().forEach((track) => {
      if (!existing.has(track.id)) {
        pc.addTrack(track, state.audioStream)
      }
    })
  }
  if (state.videoStream) {
    state.videoStream.getTracks().forEach((track) => {
      if (!existing.has(track.id)) {
        pc.addTrack(track, state.videoStream)
      }
    })
  }
  if (state.screenStream) {
    state.screenStream.getTracks().forEach((track) => {
      if (!existing.has(track.id)) {
        pc.addTrack(track, state.screenStream)
      }
    })
  }
}

/**
 * Initiate offer negotiation with a peer
 * @param {string} peerId
 */
const negotiatePeer = async (peerId) => {
  const pc = createPeerConnection(peerId)
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
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
}

/**
 * Add a media stream tile to the grid
 * @param {MediaStream} stream
 * @param {string} label - Display label
 * @param {boolean} isLocal - Whether this is local or remote stream
 */
const addStreamTile = (stream, label, isLocal) => {
  if (state.streamTiles.has(stream.id)) {
    return
  }
  const tile = document.createElement('div')
  tile.className = 'stream-tile'
  const video = document.createElement('video')
  video.autoplay = true
  video.muted = isLocal
  video.playsInline = true
  video.srcObject = stream
  const caption = document.createElement('div')
  caption.className = 'stream-label'
  caption.textContent = isLocal ? `${label} (you)` : label
  tile.appendChild(video)
  tile.appendChild(caption)
  dom.streams.appendChild(tile)
  state.streamTiles.set(stream.id, tile)
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
  }
}

/**
 * Start audio capture (microphone)
 */
const startAudio = async () => {
  if (state.audioStream) {
    return
  }
  state.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  state.peerConnections.forEach((pc, peerId) => {
    attachLocalTracks(pc)
    negotiatePeer(peerId)
  })
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
}

/**
 * Start video capture (camera)
 */
const startVideo = async () => {
  if (state.videoStream) {
    stopVideo()
    return
  }
  state.videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 }, audio: false })
  addStreamTile(state.videoStream, 'Camera', true)
  notifyStreamPublish('cam', 'camera', 'Camera', state.videoStream)
  state.peerConnections.forEach((pc, peerId) => {
    attachLocalTracks(pc)
    negotiatePeer(peerId)
  })
  dom.toggleMediaBtn.textContent = 'Stop video'
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
  dom.toggleMediaBtn.textContent = 'Start video'
}

/**
 * Start screen capture for sharing
 */
const startScreenShare = async () => {
  if (state.screenStream) {
    stopScreenShare()
    return
  }
  state.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
  addStreamTile(state.screenStream, 'Screen', true)
  notifyStreamPublish('screen', 'screen', 'Screen', state.screenStream)
  state.peerConnections.forEach((pc, peerId) => {
    attachLocalTracks(pc)
    negotiatePeer(peerId)
  })
  dom.shareScreenBtn.textContent = 'Stop share'
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
  dom.shareScreenBtn.textContent = 'Share screen'
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
    send('auth.invite_redeem', {
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
    send('auth.signin', { handle, password })
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
    const hubId = state.selectedHubIdForChannelCreation || dom.modalHubSelect.value
    
    if (!name) {
      showToast('Please enter a channel name')
      return
    }
    
    if (!hubId) {
      showToast('Please select a hub')
      return
    }
    
    send('channel.create', { hub_id: hubId, kind: 'text', name, visibility: kind })
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

  // Voice call listeners
  dom.startCallBtn.addEventListener('click', () => {
    if (!state.currentChannelId) {
      return
    }
    const existingCall = state.channelCallMap.get(state.currentChannelId)
    if (state.callId) {
      send('rtc.leave', { call_id: state.callId, peer_id: state.selfPeerId })
      teardownCall()
      return
    }
    state.voiceActive = true
    if (existingCall) {
      state.callId = existingCall
      state.callChannelId = state.currentChannelId
      send('rtc.join', { call_id: existingCall, peer_meta: { device: 'browser', capabilities: { screen: true } } })
      return
    }
    send('rtc.call_create', { channel_id: state.currentChannelId, kind: 'mesh', media: { audio: true, video: true } })
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
updateCallControls()
connect()


