
require "tokenizer"

-----------------------------------------------------------------------------
MusicData = {}

MusicData.CMD_NOTE			= 1
MusicData.CMD_TEMPO			= 2
MusicData.CMD_LOOP_POINT	= 3
MusicData.CMD_LOOP_BEGIN	= 4
MusicData.CMD_LOOP_END		= 5
MusicData.CMD_LOOP_EXIT		= 6
MusicData.CMD_KEYON_RATE	= 7
MusicData.CMD_PITCH_LFO_ON	= 8
MusicData.CMD_PITCH_LFO_OFF	= 9
MusicData.CMD_PITCH_LFO		= 10
MusicData.CMD_AMP_LFO_ON	= 11
MusicData.CMD_AMP_LFO_OFF	= 12
MusicData.CMD_AMP_LFO		= 13
MusicData.CMD_LFO_DELAY		= 14

--[[
commands

* note
	note1.w
	note2.w
	clock.b		: 0 = 256  
	volume.b
	program.b 	: bit0-3: program, bit7: keyoff

* tempo
	tempo.w 	: tempo * 64

* loop point

* loop begin

* loop end
	count.b

* loop exit

* key on rate
	rate.b		: q0-8 / 16:@q1, 17:@q2, ...

* pitch LFO ON

* pitch LFO OFF

* pitch LFO
	mode.b	(0: saw, 1: square, 2: triangle)
	quaterPeriodClock.b
	scale.w

* amplitude LFO ON

* amplitude LFO OFF

* amplitude LFO
	mode.b	(0: saw, 1: square, 2: triangle)
	quaterPeriodClock.b
	scale.w

* LFO delay
	clock.b

--]]

--------------------------------------
function MusicData:save(filename)
	local file = io.open(filename, "wb")
	--[[
		magic: M825

		tones.b
		tone[0].data[30]
		tone[1]...

		channels.b
		channel[0].len.w
		channel[0].data[len]
		channel[1]...
	]]

	file:write("M825");

	--Tone
	local nTones = #self.instData
	file:write(string.char(nTones))
	for i = 1,nTones do
		local t = self.instData[i]
		if t:len() == 30 then
			file:write(t)
		else
			error("invalid tone data")
		end
	end

	--Data
	local nCh = #self.cmds
	file:write(string.char(nCh))
	for i = 1,nCh do
		local cmd = self.cmds[i]
		local l = #cmd
		print("ch["..i.."] "..l.." bytes.")
		file:write(string.char(
			bit32.extract(l,0,8), bit32.extract(l,8,8)))
		file:write(cmd)
	end

	io.close(file)
end

--------------------------------------
function MusicData:load(filename)
	local file = io.open(filename, "rb");
	local magic = file:read(4)
	if magic ~= "M825" then
		error("invlid magic")
	end

	--Tone
	local nTones = file:read(1):byte()
--	print(nTones.." tones\n")
	for i = 1,nTones do
		self.instData[i] = file:read(30)
	end

	--Data
	local nCh = file:read(1):byte()
--	print(nCh.." channels\n")
	for i = 1,nCh do
		local l0, l1 = file:read(2):byte(1,2)
		local l = l0 + l1*256
--		print("ch["..i.."]"..l.." bytes.")
		self.cmds[i] = file:read(l)
	end

	io.close(file)
--	print("load success.")
	
	end

--------------------------------------
function MusicData.new()
	local obj = {}
	obj.cmds = {}
	obj.instData = {}
	obj.title = ""
	obj.composer = ""
	return setmetatable(obj, {__index = MusicData})
end

