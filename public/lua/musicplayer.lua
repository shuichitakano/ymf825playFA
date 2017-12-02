require "musicdata"
-----------------------------------------------------------------------------

MusicPlayer = {}
MusicPlayer.ChState = {}
MusicPlayer.LoopState = {}
MusicPlayer.Context = {}
MusicPlayer.cmdFunc	= {}
MusicPlayer.LFO = {}

-----------------------------------------------------------------------------
function MusicPlayer.LoopState.new()
	local obj = {}
	obj.topIdx		= nil
	obj.endIdx		= nil
	obj.leftCount	= nil
	return setmetatable(obj, {__index = MusicPlayer.LoopState})
end

function MusicPlayer.LoopState:decCount()
	self.leftCount = self.leftCount - 1
	return self.leftCount <= 0
end

-----------------------------------------------------------------------------
function MusicPlayer.LFO.new()
	local obj = {}
	obj.value			= 0
	obj.enabled			= false
	obj.mode			= 0
	obj.period			= 1
	obj.scale			= 1
	return setmetatable(obj, {__index = MusicPlayer.LFO})
end

MusicPlayer.LFO.shapeTable 
 = { 0.5,0,  0.5,0.5,  0.5,-1,  0.5,-0.5, 
     0,1,    0,1,      0,-1,    0,-1,
     1,0,   -1,1,     -1,0,     1,-1 }

function MusicPlayer.LFO:tick(clock, keyOnClock, delay)
	if not self.enabled then
		return
	end
	
	local dclk = 0
	if delay > 0 then
		dclk = clock - keyOnClock - delay
		if dclk < 0 then
			self.value = 0
			return
		end
	else
		dclk = clock
	end
	
	local quadrant = math.floor(dclk / self.period)
	local phase = (dclk / self.period - quadrant)
	quadrant = bit32.band(quadrant, 3)

	local ofs = quadrant * 2 + self.mode * 8
	local scale = MusicPlayer.LFO.shapeTable[ofs + 1]
	local bias  = MusicPlayer.LFO.shapeTable[ofs + 2]
	
	self.value = self.scale * (scale * phase + bias)
	--print("p"..self.period..", dclk "..dclk..", q:"..quadrant..", p:"..phase..", v:"..self.value)

end

function MusicPlayer.LFO:enable(f)
	self.enabled = f
	if not f then
		self.value = 0
	end
end

-----------------------------------------------------------------------------
function MusicPlayer.ChState.new(dev)
	local obj = {}
	obj.cmds			= nil
	obj.currentIdx 		= 0
	obj.loopPointIdx	= nil
	obj.loopStates		= {}

	obj.keyOnTrigger	= false
	obj.keyOn			= false
	obj.program			= 0
	obj.note			= nil
	obj.noteStep		= nil
	obj.noteClock		= 0
	obj.keyOnClock		= 0
	
	obj.keyOnRate		= 1
	obj.keyOffShift		= 0
	obj.volume			= 0

	obj.currentVolume	= -1
	obj.currentNote		= -1

	obj.LFOdelay		= 0
	obj.pitchLFO		= MusicPlayer.LFO.new()
	obj.ampLFO			= MusicPlayer.LFO.new()

	obj.keyOffClock		= nil
	obj.nextEventClock	= 0
	
	return setmetatable(obj, {__index = MusicPlayer.ChState})
end

function MusicPlayer.ChState:nextCommand()
	self.currentIdx 	= self.currentIdx + 1
	return string.byte(self.cmds, self.currentIdx)
end

function MusicPlayer.ChState:pushLoop(idx)
	local l = MusicPlayer.LoopState.new()
	l.topIdx = idx
	self.loopStates[#self.loopStates + 1] = l
end

function MusicPlayer.ChState:getCurrentLoop()
	return self.loopStates[#self.loopStates]
end

function MusicPlayer.ChState:popLoop()
	self.loopStates[#self.loopStates] = nil
end

-----------------------------------------------------------------------------
function MusicPlayer.new(data, device)
	local obj = {}
	obj.data				= data
	obj.device				= device
	obj.time				= nil
	obj.clock				= 0
	obj.clockPerMS			= 0.096
	obj.playing				= false
	obj.loopCount			= 0
	obj.maxLoop				= 2

	obj.masterVol			= 32
	obj.currentMasterVol	= 0
	obj.fadeStart			= nil
	obj.fadeTime			= 1000	--ms

	obj.chStates			= {}

	for i = 1, 16 do
		local st = MusicPlayer.ChState.new()
		local cmds = data.cmds[i]
		if cmds and string.len(cmds) > 0 then
			st.cmds = cmds
			obj.playing = true
		end
		print(string.format("ch %d is %s", i, st.cmds and "enabled" or "disabled"))
		obj.chStates[i] = st
	end
	
	device:defineTones(data.instData)
	
	return setmetatable(obj, {__index = MusicPlayer})
end

----------------------------------
function MusicPlayer:setTempo(v)
	self.clockPerMS = v * (48 / 60000)
end

----------------------------------
function MusicPlayer:isPlaying(v)
	return self.playing
end

----------------------------------
function MusicPlayer:tick(timeInMS)
	if self.time == nil then
		self.time = timeInMS
	end
	
	local dt = timeInMS - self.time
	if dt == 0 then
		return
	end

	self.time = timeInMS
	self.clock = self.clock + self.clockPerMS * dt

	--print(string.format("clock = %f, dt %f", self.clock, dt))

	local playing = false
	for i = 1, 16 do
		local chState = self.chStates[i]
		
		while chState and chState.cmds do
			playing = true
			if self:tickCh(i, chState) then
				break
			end
		end
	end

	local vol = self.masterVol
	if self.fadeStart then
		local t = timeInMS - self.fadeStart
		vol = (1 - t / self.fadeTime) * vol
		if vol < 0 then
			vol = 0
			playing = false
		end
	end
	if vol ~= currentMasterVol then
		self.device:setMasterVolume(vol)
		self.currentMasterVol = vol
	end
	
	self.playing = playing
end

----------------------------------
function MusicPlayer:fadeOut()
	if self.fadeStart == nil then
		self.fadeStart = self.time
	end
end

----------------------------------
function MusicPlayer:setMasterVolume(v)
	self.masterVol = v
end

----------------------------------
function MusicPlayer:tickCh(ch, chState)
	--print(string.format("[%d]: next %f, keyoff %f", ch, chState.nextEventClock, chState.keyOffClock or -1))
	if chState.keyOffClock and chState.keyOffClock <= self.clock then
		--print(self.clock..":"..ch..": key off")
		
		self.device:selectCh(ch)
		self.device:keyOff()
		chState.keyOffClock = nil
		chState.note = nil
		chState.keyOn = false
	end
	if chState.nextEventClock <= self.clock then
		--print(self.clock..":"..ch..": cmd "..chState.currentIdx.."/"..#chState.cmds)
		
		local cmd = chState:nextCommand()
		if cmd == nil then
			-- data tail --
			if chState.loopPointIdx then
				chState.currentIdx = chState.loopPointIdx
				if ch == 1 then
					self.loopCount = self.loopCount + 1
					if self.loopCount >= self.maxLoop then
						self:fadeOut()
					end
				end
				cmd = chState:nextCommand()
			else
				print(self.clock..":"..ch..": data end, clock"..chState.nextEventClock)
				chState.cmds = nil
				return
			end
		end

		--print("["..ch.."] cmd = "..cmd)
		MusicPlayer.cmdFunc[cmd](ch, chState.nextEventClock, chState, self)
		return false
	end
	
	if chState.keyOn then
		chState.pitchLFO:tick(self.clock, chState.keyOnClock, chState.LFOdelay)
		chState.ampLFO:tick(self.clock, chState.keyOnClock, chState.LFOdelay)
	end
	
	if chState.note then
		local p = 0
		if chState.noteStep then
			p = (self.clock - chState.noteClock) * chState.noteStep
		end
		local v = chState.note + p + chState.pitchLFO.value
		--print("note "..v)
		if v ~= chState.currentNote then
			chState.currentNote = v
			self.device:selectCh(ch)
			self.device:setNote(v)
		end
	end
	
	local vol = chState.volume + chState.ampLFO.value
	if vol ~= chState.currentVolume then
		chState.currentVolume = vol
		self.device:selectCh(ch)
		self.device:setVolume(vol)
	end
	
	if chState.keyOnTrigger then
		chState.keyOnTrigger = false
		self.device:selectCh(ch)
		self.device:keyOn()
	end
	
	return true
end


-----------------------------------------------------------------------------
MusicPlayer.cmdFunc[MusicData.CMD_NOTE] = function(ch, clock, chState, context)
	
	local i = chState.currentIdx
	--print("ch="..ch..", l = "..string.len(chState.cmds)..", i = "..i)
	local n1l, n1h, n2l, n2h, clk, vol, prg
		= string.byte(chState.cmds, i+1, i+7)
	chState.currentIdx = i + 7

	if clk == 0 then
		clk = 256
	end

	--print(string.format("ch[%d] note %d, note2 %d, clk %d, v %d, prg %d", ch, n1l + n1h*256, n2l + n2h * 256, clk, vol, prg))
	
	local keyOff = prg >= 128
	local note1 = (n1l + n1h * 256) * 0.015625
	local note2 = (n2l + n2h * 256) * 0.015625

	chState.noteClock = clock
	chState.nextEventClock 	= clk + clock
	local length = chState.keyOnRate * clk - chState.keyOffShift
	if length < 1 then
		length = 1
	end

	if keyOff then
		chState.keyOffClock = length + clock
	else
		length = clk
	end
	
	if n2h == 255 then
		chState.note = n1h ~= 255 and note1 or nil
		chState.noteStep = nil
	else
		chState.note = note2
		chState.noteStep = (note1 - note2) / length
	end

	if chState.note then
		context.device:selectCh(ch)
		context.device:setTone(bit32.band(prg, 15))
		chState.volume = vol

		if not chState.keyOn then
			chState.keyOn = true
			chState.keyOnTrigger = true
			chState.keyOnClock = clock
		end
	end
end

-----------------------------------------------------------------------------
MusicPlayer.cmdFunc[MusicData.CMD_TEMPO] = function(ch, clock, chState, context)
	local i = chState.currentIdx
	local l, h = string.byte(chState.cmds, i + 1, i + 2)
	chState.currentIdx = i + 2
	context:setTempo((h * 256 + l) / 64.0)
end

-----------------------------------------------------------------------------
MusicPlayer.cmdFunc[MusicData.CMD_LOOP_POINT] = function(ch, clock, chState, context)
	chState.loopPointIdx = chState.currentIdx
end

-----------------------------------------------------------------------------
MusicPlayer.cmdFunc[MusicData.CMD_LOOP_BEGIN] = function(ch, clock, chState, context)
	--print("loop begin")
	chState:pushLoop(chState.currentIdx)
end

-----------------------------------------------------------------------------
MusicPlayer.cmdFunc[MusicData.CMD_LOOP_END] = function(ch, clock, chState, context)
	local i = chState.currentIdx
	local ct = string.byte(chState.cmds, i + 1)
	chState.currentIdx = i + 1

	local l = chState:getCurrentLoop()
	if l.leftCount == nil then
		l.leftCount = ct
		l.endIdx = chState.currentIdx
	end
	
	if l:decCount() then
		chState:popLoop()
	else
		chState.currentIdx = l.topIdx
	end
end

-----------------------------------------------------------------------------
MusicPlayer.cmdFunc[MusicData.CMD_LOOP_EXIT] = function(ch, clock, chState, context)
	local l = chState:getCurrentLoop()
	if l.leftCount == 1 then
		if l.endIdx == nil then	
			error("invalid loop")
		end
		chState.currentIdx = l.endIdx
		chState:popLoop()
	end
end

-----------------------------------------------------------------------------
MusicPlayer.cmdFunc[MusicData.CMD_KEYON_RATE] = function(ch, clock, chState, context)
	local i = chState.currentIdx
	local r = string.byte(chState.cmds, i + 1)
	chState.currentIdx = i + 1

	if r < 8 then
		chState.keyOnRate = r * 0.125
		chState.keyOffShift = 0
	else
		chState.keyOnRate = 1
		chState.keyOffShift = r - 8
	end
end

-----------------------------------------------------------------------------
MusicPlayer.cmdFunc[MusicData.CMD_PITCH_LFO_ON] = function(ch, clock, chState, context)
	chState.pitchLFO:enable(true)
	chState.keyOnClock = clock
end

-----------------------------------------------------------------------------
MusicPlayer.cmdFunc[MusicData.CMD_PITCH_LFO_OFF] = function(ch, clock, chState, context)
	chState.pitchLFO:enable(false)
end

-----------------------------------------------------------------------------
MusicPlayer.cmdFunc[MusicData.CMD_PITCH_LFO] = function(ch, clock, chState, context)
	local i = chState.currentIdx
	local m, p, sl, sh = string.byte(chState.cmds, i + 1, i + 4)
	chState.currentIdx = i + 4

	local l = chState.pitchLFO
	l.mode = m
	l.period = p
	l.scale = (sl + sh * 256 - 32767) * 0.015625

	chState.keyOnClock = clock
	chState.pitchLFO:enable(true)
end

-----------------------------------------------------------------------------
MusicPlayer.cmdFunc[MusicData.CMD_AMP_LFO_ON] = function(ch, clock, chState, context)
	chState.ampLFO:enable(true)
	chState.keyOnClock = clock
end

-----------------------------------------------------------------------------
MusicPlayer.cmdFunc[MusicData.CMD_AMP_LFO_OFF] = function(ch, clock, chState, context)
	chState.ampLFO:enable(false)
end

-----------------------------------------------------------------------------
MusicPlayer.cmdFunc[MusicData.CMD_AMP_LFO] = function(ch, clock, chState, context)
	local i = chState.currentIdx
	local m, p, sl, sh = string.byte(chState.cmds, i + 1, i + 4)
	chState.currentIdx = i + 4

	local l = chState.ampLFO
	l.mode = m
	l.period = p
	l.scale = sl + sh * 256 - 32767

	chState.keyOnClock = clock
	chState.ampLFO:enable(true)
end

-----------------------------------------------------------------------------
MusicPlayer.cmdFunc[MusicData.CMD_LFO_DELAY] = function(ch, clock, chState, context)
	local i = chState.currentIdx
	chState.LFOdelay = string.byte(chState.cmds, i + 1)
	chState.currentIdx = i + 1
end
