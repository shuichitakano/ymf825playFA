
--forTest = true

function main()
    
    if forTest then
        package.path = "./?.lua"
    else
        package.path = "/lua/?.lua"
    end
    
    require "musicdata"
    require "musicplayer"
    require "ymf825"

    if #arg < 1 then
        error("no input")
    end

    local input = arg[1]
    
    local chMask = 65535
    local volume = 32
    
    if arg[2] then
        volume = tonumber(arg[2])
    end
    
--    print(string.format("input = %s, volume = %d\n", input, volume))
    
    function updateSharedMemory()
        local r = string.format("_%02x:%04x", volume, chMask)
        writeSharedMemory(0, r)
    end
    
    updateSharedMemory()
    
    ymf825 = YMF825.new()
    ymf825:init(true)	-- dual power
    ymf825:setMasterVolume(volume)
    
    data = MusicData.new()
    data:load(input)
    collectgarbage()
    
    player = MusicPlayer.new(data, ymf825)
    
    player:setMasterVolume(volume)
    
    while player:isPlaying() do
        collectgarbage()
        player:tick(getCurrentTimeInMS())
        
        local commandStr = readSharedMemory(0, 8)
        local cmd = commandStr:sub(1, 1);
        if cmd=="!" then
            player:fadeOut()
        elseif cmd=="S" then
            local v = tonumber(commandStr:sub(2, 3), 16)
            local m = tonumber(commandStr:sub(5, 8), 16)
            --print(string.format("v = %d, m = %d", v, m))
            player:setMasterVolume(v)
            --player:setChMask(m)
            writeSharedMemory(0, "_")
        end
    
        sleep(1)
    end
    
    ymf825:setDefaultState()
    
end

--[[
local st, r = pcall(main)
if st then
    print("success")
else
    print("error!");
    print(r);
end

]]
main()

