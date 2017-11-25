
function MusicData:parseFile()
	local tokenizer = Tokenizer.new()

	local defInstMap = {}
	local defInst = nil

	local instValues = {}
	local noiseInst = {}
	local baseClock = 48
	local volumeScale = 3
	local volumeBias = 82
	local relOctaveSign = 1
	local relVolumeSign = 1

	local currentCh = nil
	local ChState = {}
	function ChState.new(ch)
		local obj = {}
		obj.ch				= ch
		obj.program			= 0
		obj.length 			= 4
		obj.tmpLength 		= 4
		obj.volume			= volumeScale * 8 + volumeBias
		obj.octave			= 4
		obj.keyShift		= 0
		obj.detune 			= 0
		obj.noise			= nil

		obj.portamento		= false
		obj.note			= 65535
		obj.note2			= 65535
		obj.clock			= 0
		obj.noteVolume		= 0
		obj.noteProgram		= 0
		obj.keyOff			= true
		return setmetatable(obj, {__index = ChState})
	end
	local chStates = {}
	
	for i = 1, 16 do
		self.cmds[i] = ""
		chStates[i] = ChState.new(i)
	end

	local currentChState = nil

	--------------------------------------
	local function parseError(str)
		error(string.format("parse error:%d:%d: %s", tokenizer.line, tokenizer.column, str))
	end

	--------------------------------------

	local function _pushCmd(cmd)
		self.cmds[currentCh] = self.cmds[currentCh]..cmd
	end

	--------------------------------------
	local function flushNote(cmd)
		if currentChState.clock > 0 then
			local cs = currentChState
			_pushCmd(string.char(MusicData.CMD_NOTE,
				bit32.band(cs.note, 255), bit32.rshift(cs.note, 8),
				bit32.band(cs.note2, 255), bit32.rshift(cs.note2, 8),
				cs.clock, cs.noteVolume, (cs.keyOff and 128 or 0) + cs.noteProgram))
			cs.clock = 0
		end
	end

	--------------------------------------
	local function pushCmd(cmd)
		flushNote()
		_pushCmd(cmd)
	end

	--------------------------------------
	local processNormalLine 	= nil
	local processDefInstLine	= nil
	local lineProc = nil

	local processNormalCommands		= nil
	local commandsProc = nil
	
	local lineCmdTable = {}
	local cmdTable = {}
	
	--------------------------------------
	lineCmdTable[string.byte("#")] = function(cmd)
		local name = tokenizer:getString()
		if name == "id" then
			self.id = tonumber(tokenizer:getString())
		elseif name == "title" then
			self.title = tokenizer:getLeftLine()
			print("title: "..self.title)
		elseif name == "composer" then
			self.composer = tokenizer:getLeftLine()
			print("composer: "..self.composer)
		end
		return false
	end

	--------------------------------------
	lineCmdTable[string.byte("@")] = function(cmd)
		local num = tonumber(tokenizer:getToken())
		local eq = tokenizer:getToken()
		local lp = tokenizer:getToken()
		if num and eq == "=" and lp == "{" then
			--print(string.format("define inst = %d", num))
			defInst = num
			lineProc = processDefInstLine
			commandsProc = processDefInstLine
		else
			parseError("define inst error.")
		end 
		return false
	end

	--------------------------------------
	local function cmdChannel(cmd)
		currentCh = cmd - string.byte("A") + 1
		currentChState = chStates[currentCh]
		--print(string.format("ch = %d", currentCh))
		return true
	end
	lineCmdTable[string.byte("A")] = cmdChannel
	lineCmdTable[string.byte("B")] = cmdChannel
	lineCmdTable[string.byte("C")] = cmdChannel
	lineCmdTable[string.byte("D")] = cmdChannel
	lineCmdTable[string.byte("E")] = cmdChannel
	lineCmdTable[string.byte("F")] = cmdChannel
	lineCmdTable[string.byte("G")] = cmdChannel
	lineCmdTable[string.byte("H")] = cmdChannel
	lineCmdTable[string.byte("I")] = cmdChannel
	lineCmdTable[string.byte("J")] = cmdChannel
	lineCmdTable[string.byte("K")] = cmdChannel
	lineCmdTable[string.byte("L")] = cmdChannel
	lineCmdTable[string.byte("M")] = cmdChannel
	lineCmdTable[string.byte("N")] = cmdChannel
	lineCmdTable[string.byte("O")] = cmdChannel
	lineCmdTable[string.byte("P")] = cmdChannel
	
	--------------------------------------
	--------------------------------------
	--------------------------------------
	cmdTable[string.byte("C")] = function(cmd)
		local num = tonumber(tokenizer:getToken(true))
		if num then
			baseClock = num
		else
			parseError("invalid base clock")
		end
	end

	--------------------------------------
	cmdTable[string.byte("t")] = function(cmd)
		local num = tonumber(tokenizer:getToken(true))
		if num then
			local v = math.floor(num * 64)
			pushCmd(string.char(MusicData.CMD_TEMPO, bit32.band(v, 255), bit32.rshift(v, 8)))
		else
			parseError("invalid tempo command")
		end
	end

	--------------------------------------
	cmdTable[string.byte("K")] = function(cmd)
		local num = tonumber(tokenizer:getToken(true))
		if num then
			currentChState.keyShift = num
		else
			parseError("invalid key shift command")
		end
	end

	--------------------------------------
	cmdTable[string.byte("L")] = function(cmd)
		pushCmd(string.char(MusicData.CMD_LOOP_POINT))
	end

	--------------------------------------
	cmdTable[string.byte("@")] = function(cmd)
		local arg = tokenizer:getToken(true)
		local num = tonumber(arg)
		if num then
			local idx = defInstMap[num]
			if idx then
				currentChState.program = idx
			else
				parseError("program "..num.." is not defined")
			end
		elseif arg == "v" then
			local v = tonumber(tokenizer:getToken(true))
			if v then
				currentChState.volume = v
			else
				parseError("invalid volume command")
			end
		elseif arg == "t" then
			local v = tonumber(tokenizer:getToken(true))
			if v then
				local tick = 1024 * (256 - v)/4000000
				local t = 60/(tick * baseClock)
				--print("tempo = "..t)
				local v = math.floor(t * 64)
				pushCmd(string.char(MusicData.CMD_TEMPO, bit32.band(v, 255), bit32.rshift(v, 8)))
			else
				parseError("invalid tempo command")
			end
		else
			parseError("invalid @ command")
		end
	end

	--------------------------------------
	cmdTable[string.byte("v")] = function(cmd)
		local num = tonumber(tokenizer:getToken(true))
		if num then
			currentChState.volume = num * volumeScale + volumeBias
		else
			parseError("invalid volume command")
		end
	end

	--------------------------------------
	cmdTable[string.byte("o")] = function(cmd)
		local num = tonumber(tokenizer:getToken(true))
		if num then
			currentChState.octave = num
		else
			parseError("invalid octave command")
		end
	end

	--------------------------------------
	cmdTable[string.byte("p")] = function(cmd)
		local num = tonumber(tokenizer:getToken(true))
		if num then
			--not supported yet
			--print("pan = "..num)
		else
			parseError("invalid pan command")
		end
	end

	--------------------------------------
	cmdTable[string.byte("l")] = function(cmd)
		local num = tonumber(tokenizer:getToken(true))
		if num then
			currentChState.length = num
		else
			parseError("invalid length command")
		end
	end

	--------------------------------------
	cmdTable[string.byte("q")] = function(cmd)
		local num = tonumber(tokenizer:getToken(true))
		if num then
			pushCmd(string.char(MusicData.CMD_KEYON_RATE, num))
		else
			parseError("invalid key on rate command")
		end
	end

	--------------------------------------
	cmdTable[string.byte("+")] = function(cmd)
		currentChState.note = currentChState.note + 64
	end

	--------------------------------------
	cmdTable[string.byte("-")] = function(cmd)
		currentChState.note = currentChState.note - 64
	end

	--------------------------------------
	cmdTable[string.byte("&")] = function(cmd)
		currentChState.keyOff = false
	end

	--------------------------------------
	cmdTable[string.byte("_")] = function(cmd)
		currentChState.portamento = true
	end

	--------------------------------------
	cmdTable[string.byte(".")] = function(cmd)
		local l = currentChState.tmpLength
		l = l * 2
		currentChState.tmpLength = l
		currentChState.clock = currentChState.clock + baseClock * 4 / l

	end

	--------------------------------------
	cmdTable[string.byte("D")] = function(cmd)
		local num = tonumber(tokenizer:getToken(true))
		if num then
			currentChState.detune = num/64
			--print("detune: "..currentChState.detune)
		else
			parseError("invalid detune command")
		end
	end

	--------------------------------------
	cmdTable[string.byte("w")] = function(cmd)
		local tk = tokenizer:getToken(true)
		local num = tonumber(tk)
		if num then
			chStates.noise = num
		else
			chStates.noise = nil
			tokenizer:returnToken(tk)
		end
	end

	--------------------------------------
	cmdTable[string.byte("[")] = function(cmd)
		pushCmd(string.char(MusicData.CMD_LOOP_BEGIN))
	end

	--------------------------------------
	cmdTable[string.byte("]")] = function(cmd)
		local num = tokenizer:getToken(true)
		local count = tonumber(num)
		if count == nil then
			count = 2
			tokenizer:returnToken(num)
		end
		pushCmd(string.char(MusicData.CMD_LOOP_END, count))
	end

	--------------------------------------
	cmdTable[string.byte("/")] = function(cmd)
		pushCmd(string.char(MusicData.CMD_LOOP_EXIT))
	end

	--------------------------------------
	cmdTable[string.byte(">")] = function(cmd)
		currentChState.octave = currentChState.octave + relOctaveSign
	end

	--------------------------------------
	cmdTable[string.byte("<")] = function(cmd)
		currentChState.octave = currentChState.octave - relOctaveSign
	end

	--------------------------------------
	cmdTable[string.byte(")")] = function(cmd)
		currentChState.volume = math.min(127, math.max(0, currentChState.volume + volumeScale * relVolumeSign))
	end

	--------------------------------------
	cmdTable[string.byte("(")] = function(cmd)
		currentChState.volume = math.min(127, math.max(0, currentChState.volume - volumeScale * relVolumeSign))
	end

	--------------------------------------
	cmdTable[string.byte("%")] = function(cmd)
		local clock = tonumber(tokenizer:getToken(true))
		if clock then
			currentChState.clock = clock
		else
			parseError("invalid note length")
		end
	end

	--------------------------------------
	cmdTable[string.byte("M")] = function(cmd)
		local arg1 = tokenizer:getToken()
		if arg1 == "P" then
			local arg2 = tokenizer:getToken()
			if arg2 == "O" then
				local arg3 = tokenizer:getToken()
				if arg3 == "N" then
					pushCmd(string.char(MusicData.CMD_PITCH_LFO_ON))
				elseif arg3 == "F" then
					pushCmd(string.char(MusicData.CMD_PITCH_LFO_OFF))
				else
					parseError("invalid freq LFO parameter")
				end
			else
				tokenizer:returnToken(arg2)
				local v = tokenizer:getVector()
				if v and #v == 3 then
					local s = v[3] + 32767
					pushCmd(string.char(MusicData.CMD_PITCH_LFO, v[1], v[2], bit32.band(s, 255), bit32.rshift(s, 8)))
				else
					parseError("invalid freq LFO parameter")
				end
			end
		elseif arg1 == "A" then
			local arg2 = tokenizer:getToken()
			if arg2 == "O" then
				local arg3 = tokenizer:getToken()
				if arg3 == "N" then
					pushCmd(string.char(MusicData.CMD_AMP_LFO_ON))
				elseif arg3 == "F" then
					pushCmd(string.char(MusicData.CMD_AMP_LFO_OFF))
				else
					parseError("invalid volume LFO parameter")
				end
			else
				tokenizer:returnToken(arg2)
				local v = tokenizer:getVector()
				if v and #v == 3 then
					local s = v[3] + 32767
					pushCmd(string.char(MusicData.CMD_AMP_LFO, v[1], v[2], bit32.band(s, 255), bit32.rshift(s, 8)))
				else
					parseError("invalid volume LFO parameter")
				end
			end
		elseif arg1 == "D" then
			local v = tonumber(tokenizer:getToken(true))
			if v then
				pushCmd(string.char(MusicData.CMD_LFO_DELAY, v))
			else
				parseError("invalid LFO delay")
			end
		elseif arg1 == "H" then
			local arg2 = tokenizer:getToken()
			if arg2 == "O" then
				local arg3 = tokenizer:getToken()
				if arg3 == "N" then
					--print("hw lfo on")
				elseif arg3 == "F" then
					--print("hw lfo off")
				else
					parseError("invalid hw LFO parameter")
				end
			else
				tokenizer:returnToken(arg2)
				local v = tokenizer:getVector()
				print("v len "..#v)
				if v and (#v == 6 or #v == 7) then
					--print("hw lfo params")
				else
					parseError("invalid hw LFO parameter")
				end
			end
		else
			parseError("invalid M parameter")
		end
	end


	--------------------------------------
	local function noteFunc(cmd)
		local cs = currentChState

		if cs.portamento then
			cs.note2 = cs.note
			cs.portamento = false
		else
			flushNote()
			cs.clock = 0
			cs.note  = 65535
			cs.note2 = 65535
			cs.keyOff = true
			cs.noteProgram = cs.program
			cs.noteVolume = cs.volume
		end
		
		local l = currentChState.length
		cs.clock = baseClock * 4 / l
		local note = cmd - string.byte("a")
		if note < 7 then
			local noteTable = { 9, 11, 0, 2, 4, 5, 7 }
			cs.note = math.floor((noteTable[note + 1] + cs.octave * 12 + cs.keyShift + cs.detune) * 64)
		else
			cs.keyOff = false
		end
		
		if noise then
			noiseInst[cs.program] = noise
		end
	end

	cmdTable[string.byte("a")] = noteFunc
	cmdTable[string.byte("b")] = noteFunc
	cmdTable[string.byte("c")] = noteFunc
	cmdTable[string.byte("d")] = noteFunc
	cmdTable[string.byte("e")] = noteFunc
	cmdTable[string.byte("f")] = noteFunc
	cmdTable[string.byte("g")] = noteFunc
	cmdTable[string.byte("r")] = noteFunc

	--------------------------------------
	--------------------------------------
	--------------------------------------
	local function checkComment()
		local cmd = tokenizer:peekChar()
		return cmd and cmd ~= string.byte("/") and cmd ~= string.byte("*")
	end

	--------------------------------------
	processNormalLine = function()
		local cmd = tokenizer:getChar()
		if cmd > 0x20 then
			local cmdFunc = lineCmdTable[cmd]
			if cmdFunc then
				if cmdFunc(cmd) then
					commandsProc()
				end
			else
				parseError("invalid line command: "..string.char(cmd)..":"..cmd)
			end
		end
		
	end

	--------------------------------------
	processDefInstLine = function()
		local comma = false
		while true do
			local tk = tokenizer:getToken()
			if string.len(tk) == 0 then
				break
			end
			
			if tk == "}" then
				local idx = #self.instData
				defInstMap[defInst] = idx
				
				--print("tone @"..defInst.." -> @"..idx)
				
				if #instValues ~= 11*4+3 then
					parseError("invalid inst data")
				end
				
				local tmp = {}
				tmp[1] = 0	--BO
				
				-- alg, slotMask, fbMask, srcSlotMap0, 1, 2, 3
				local algTbl = {
					{ 4, 15, 1,  0, 1, 2, 3 },	--0: OK
					{ 3, 15, 0,  2, 1, 0, 3 },	--1: FB 無効 全然違う
					{ 3, 15, 1,  0, 1, 2, 3 }, 	--2: OK
					{ 3, 15, 0,  1, 2, 0, 3 },	--3: FB 無効
					{ 5, 15, 1,  0, 1, 2, 3 },	--4: OK
					{ 5, 15, 5,  0, 2, 0, 3 },	--5: op2 なし...
					{ 5, 11, 1,  0, 1, 2, 3 },	--6: op3 なし...
					{ 2, 15, 1,  0, 2, 1, 3 },	--7: OK
				}

				local srcAlg = instValues[45]
				local tbl = algTbl[srcAlg + 1]
				local alg = tbl[1]
				local dstSlotMask = tbl[2]
				local fbi = tbl[3]

				tmp[2] = alg

				local fl = instValues[46]
				local srcSlotMask = instValues[47]

				--if noiseInst[idx]

				for i=0, 3 do
					local sop = tbl[i + 4]
					local sofs = sop * 11
					local ms = bit32.lshift(1, sop)
					local md = bit32.lshift(1, i)
					local enabled = bit32.band(srcSlotMask, ms) > 0 and bit32.band(dstSlotMask, md) > 0
					local fbEnable = bit32.band(fbi, md) > 0
					local ar  = instValues[sofs + 1]
					local dr  = instValues[sofs + 2]
					local sr  = instValues[sofs + 3]
					local rr  = instValues[sofs + 4]
					local sl  = instValues[sofs + 5]
					local tl  = enabled and math.min(63, instValues[sofs + 6]) or 63
					local ks  = instValues[sofs + 7]
					local ml  = instValues[sofs + 8]
					local dt1 = instValues[sofs + 9]
					local dofs = i * 7
					tmp[dofs + 3] = bit32.lshift(bit32.band(sr, 30), 3)
					tmp[dofs + 4] = bit32.lshift(rr, 4) + bit32.rshift(dr, 1)
					tmp[dofs + 5] = bit32.lshift(bit32.band(ar, 30), 3) + sl
					--tmp[dofs + 6] = bit32.lshift(tl, 2) + ks
					tmp[dofs + 6] = bit32.lshift(tl, 2)
					tmp[dofs + 7] = 0
					tmp[dofs + 8] = bit32.lshift(ml, 4) + dt1
					tmp[dofs + 9] = fbEnable and fl or 0
				end
				
				--[[
				for i=1,30 do
					print(string.format("%02x ", tmp[i]))
				end
				print("\n")
				--]]
				self.instData[idx + 1] = string.char(unpack(tmp))

				defInst = nil
				instValues = {}
				lineProc 		= processNormalLine
				commandsProc	= processNormalCommands
			elseif tk == "," then
				if comma then
					parseError("invalid comma");
				end
				comma = true
			else
				v = tonumber(tk)
				if v then
					instValues[#instValues + 1] = v
					comma = false
				else
					parseError("define inst error.")
				end
			end
		end
	end

	--------------------------------------
	processNormalCommands = function()
		if currentCh == nil then
			parseError("no channel")
		end

		while true do
			local tk = tokenizer:getToken()
			if string.len(tk) == 0 then
				break
			end

			num = tonumber(tk)
			if num then
				currentChState.tmpLength = num
				currentChState.clock = baseClock * 4 / num
			else
				cmd = string.byte(tk)
				local cmdFunc = cmdTable[cmd]
				if cmdFunc then
					--print("cmd:"..tk)
					cmdFunc(cmd)
				else
					parseError("invalid command: "..tk)
				end
			end
		end
	end

	--------------------------------------
	--------------------------------------
	lineProc 		= processNormalLine
	commandsProc	= processNormalCommands
	
	for line in io.lines() do
		tokenizer:nextLine(line)
		--collectgarbage()
		if checkComment() then
			lineProc()
		end
	end
	
	for i=1,16 do
		currentCh = i
		currentChState = chStates[i]
		flushNote()
	end
end
