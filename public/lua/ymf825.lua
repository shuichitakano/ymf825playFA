
if forTest then
	require("test_device")
else
	require("flashair_device")
end

YMF825 = {}

function YMF825.new()
	local obj = {}
	obj.chToneID = {}
	obj.currentCh = nil
	return setmetatable(obj, {__index = YMF825})
end

function YMF825.regWrite(addr, data)
	spi_setss(0)
	spi_write(addr)
	spi_write(data)
	spi_setss(1)
end

function YMF825.regRead(addr)
	spi_setss(0)
	spi_write(addr)
	rcv = spi_read(0x00)
	spi_setss(1)
	return rcv
end

function YMF825.beginFIFO()
	spi_setss(0)
	spi_write(7)
end

function YMF825.writeFIFO(data)
	for i=1, #data do
		spi_write(data[i])
	end
end

function YMF825.writeFIFO2(dataStr)
	local l = dataStr:len()
	for i=1,l do
		spi_write(dataStr:byte(i))
	end
end


function YMF825.endFIFO()
	spi_setss(1)
end

function YMF825:init(dualPowerMode)
	device_setup()
	
	YMF825.regWrite(0x1D, dualPowerMode and 1 or 0)
	YMF825.regWrite(0x02, 0x0E)
	sleep(1)
	YMF825.regWrite(0x00, 0x01)	--CLKEN
	YMF825.regWrite(0x01, 0x00)	--ALRST
	YMF825.regWrite(0x1A, 0xA3)
	sleep(1)
	YMF825.regWrite(0x1A, 0x00)
	sleep(30)
	YMF825.regWrite(0x02, 0x04)	--AP1,AP3
	sleep(1)
	YMF825.regWrite(0x02, 0x00)
	
	YMF825.regWrite(0x19, 0xF0)	--MASTER VOL
	YMF825.regWrite(0x1B, 0x3F)	--interpolation
	YMF825.regWrite(0x14, 0x00)	--interpolation
	YMF825.regWrite(0x03, 0x01)	--Analog Gain
	
	YMF825.regWrite(0x08, 0xF6)
	sleep(21)
	YMF825.regWrite(0x08, 0x00)
	YMF825.regWrite(0x09, 0xF8)
	YMF825.regWrite(0x0A, 0x00)
	
	YMF825.regWrite(0x17, 0x40)	--MS_S
	YMF825.regWrite(0x18, 0x00)

	self:setDefaultState()
end

function YMF825:setDefaultState()
	--[[
	local defaultTone = {
		0x01,0x85,
		0x00,0x7F,0xF4,0xBB,0x00,0x10,0x40,
		0x00,0xAF,0xA0,0x0E,0x03,0x10,0x40,
		0x00,0x2F,0xF3,0x9B,0x00,0x20,0x41,
		0x00,0xAF,0xA0,0x0E,0x01,0x10,0x40,
	}
	]]
	local defaultTone = {
		0x00,0x05,
		0x00,0x00,0xf0,0x68,0x00,0x40,0x07, 
		0x00,0x67,0xf3,0x88,0x00,0x60,0x00, 
		0x00,0x00,0xf0,0x68,0x00,0x40,0x07, 
		0x00,0x67,0xf3,0x10,0x00,0x20,0x00,
	} 
	self:defineTones({string.char(unpack(defaultTone))})
	
	for i=1, 16 do
		self:selectCh(i)
		self:setTone(0)
		self:setVolume(64)
		self:setFrac(1.0)
		self:keyOff()
	end
end


function YMF825:defineTones(tones)
	YMF825.regWrite(8, 0xf6)		-- allKeyOff, allMute, allEFRst. R_FIFOR, R_SEQ, R_FIFO
	sleep(1)
	YMF825.regWrite(8, 0)
	
	local n = #tones
	YMF825.beginFIFO()
	YMF825.writeFIFO({ 0x80 + n })
	for i = 1,n do
		local t = tones[i]
		if t:len() == 30 then
			YMF825.writeFIFO2(t)
		else
			error("invalid tone data")
		end
	end
	
	YMF825.writeFIFO({ 0x80, 0x03, 0x81, 0x80 })
	YMF825.endFIFO()
end

function YMF825:selectCh(ch)
	if self.currentCh == ch then
		return
	end
	
	YMF825.regWrite(11, ch - 1)
	self.currentCh = ch
end

function YMF825:setTone(v)
	self.chToneID[self.currentCh] = v
end

function YMF825:keyOn()
	YMF825.regWrite(15, self.chToneID[self.currentCh] + 0x40)
end

function YMF825:keyOff()
	YMF825.regWrite(15, self.chToneID[self.currentCh])
end

function YMF825:setFrac(v)
	local i = math.floor(v * 1024)
	YMF825.regWrite(18, bit32.arshift(i, 7))
	YMF825.regWrite(19, bit32.band(i, 127))
end

function YMF825:setNote(v)
	local oct = math.floor(v / 12)
	local i = v - oct * 12
	local fn = math.floor(math.pow(2, 0.0833333 * i + 8.48061) + 0.5)
	oct = math.min(7, math.max(0, oct - 1))
	local fn_h = bit32.band(bit32.arshift(fn, 4), 0xf8) + oct
	local fn_l = bit32.band(fn, 127)
	YMF825.regWrite(13, fn_h)
	YMF825.regWrite(14, fn_l)
end

function YMF825:setVolume(v)
	local cv = math.floor(math.exp(0.0446232 * v -2.23316))
	YMF825.regWrite(12, bit32.lshift(cv, 2))
end

function YMF825:setMasterVolume(v)
	local cv = math.floor(v)
	YMF825.regWrite(25, bit32.lshift(math.floor(v), 2))
end

