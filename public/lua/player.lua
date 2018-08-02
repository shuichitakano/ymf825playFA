
--forTest = true

if forTest then
	package.path = "./?.lua"
	path = ""
else
	package.path = "/lua/?.lua"
	path = "/music/"
end

--require "tokenizer"
require "musicdata"
require "musicdata_parser"
require "musicplayer"
require "ymf825"

if arg[1] then
	input = arg[1]
end

if not input then
	error("no input.\n");
	return;
end

playlist = {}
if input:sub(#input-8)==".playlist" then
	for l in io.lines(input) do
		print(l)
		table.insert(playlist, l)
	end
end

local chMask = 65535
local volume = 32

if arg[2] then
	volume = tonumber(arg[2])
end

listIdx = 0
if arg[3] then
	listIdx = tonumber(arg[3])
end

function updateSharedMemory()
	local r = string.format("_%02x:%04x", volume, chMask)
	writeSharedMemory(0, r)
end

exitReq = false

function main(input)

local body = input:match("^(.+)(%..+)$")
local ext = input:sub(#body + 1)

print(string.format("input = %s('%s'.'%s'), volume = %d\n", input, body, ext, volume))



updateSharedMemory()

data = MusicData.new()
if data:load(body..".mbin") then 
	collectgarbage()
	print("music data binary load success.\n");
else
	print("no binary. convert...\n");

	io.input(input)
	data:parseFile()

	local output = body..".mbin"
	print("output: "..output)
	data:save(output)	

	MusicData.parseFile = nil
	collectgarbage()
end


ymf825 = YMF825.new()
ymf825:init(true)	-- dual power
ymf825:setMasterVolume(volume)

--data:save(input..".bin")
--data:load(input..".bin")

player = MusicPlayer.new(data, ymf825)

player:setMasterVolume(volume)




while player:isPlaying() do
	collectgarbage()
	player:tick(getCurrentTimeInMS())
	
	local commandStr = readSharedMemory(0, 8)
	local cmd = commandStr:sub(1, 1);
	if cmd=="!" then
		player:fadeOut()
		exitReq = true
	elseif cmd=="S" then
		volume = tonumber(commandStr:sub(2, 3), 16)
		chMask = tonumber(commandStr:sub(5, 8), 16)
		player:setMasterVolume(volume)
		--player:setChMask(chMask)
		writeSharedMemory(0, "_")
	end

  	sleep(1)
end

ymf825:setDefaultState()

end

-- local st, r = pcall(main)
-- if st then
-- 	print("success")
-- else
-- 	print("error!")
-- 	print(r)
-- end


if next(playlist) then
	-- playlist
	while not exitReq do
		f = playlist[listIdx + 1]
		print(string.format("f[%d]:%s\n", listIdx, f))
		main(f)

		listIdx = listIdx + 1
		if listIdx >= #playlist then
			listIdx = 0
		end
	end

else
	-- single
	main(input)
end
