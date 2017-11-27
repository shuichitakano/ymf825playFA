
--forTest = true

function main()

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

    if #arg < 1 then
        error("no input")
    end

    input = arg[1]
    io.input(input)
    
    data = MusicData.new()
    data:parseFile()

    data:save(input..".bin")
    
end

local st, r = pcall(main)
if st then
	print("success")
else
	print("error!");
	print(r);
end
