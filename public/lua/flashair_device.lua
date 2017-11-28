
function spi_write(data)
	fa.spi("write", data)
end

function spi_read(data)
	return fa.spi("read", 0)
end

function spi_setss(lv)
	fa.spi("cs", lv)
end

function device_setup()
--	fa.spi("init", 1)
	fa.spi("init", 5)		--1MHz
--	fa.spi("init", 245)		--100KHz
--	fa.spi("init", 645)		--40KHz
	fa.spi("mode", 3)

	sleep(500)
	spi_setss(1)
end

function getCurrentTimeInMS()
	return os.clock() * 1000000
end

function readSharedMemory(addr, size)
	return fa.sharedmemory("read", addr, size, "")
end

function writeSharedMemory(addr, data)
	fa.sharedmemory("write", addr, data:len(), data)
end

function setLED(st)
	fa.pio(0x10, st and 0 or 0x10)
end


