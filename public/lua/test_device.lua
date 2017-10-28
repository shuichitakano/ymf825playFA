
function sleep(ms)
end

function spi_write(data)
	print(string.format("spiw: %02x", data))
end

function spi_read(data)
	return 0
end

function spi_setss(lv)
end

function device_setup()
end

function getCurrentTimeInMS()
	return os.clock() * 1000
end

function readSharedMemory(addr, size)
--	return "!"
	return "_"
end

function writeSharedMemory(addr, data)
end

