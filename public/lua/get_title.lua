print("HTTP/1.1 200 OK\nPragma: no-cache\nCache-Control: no-cache\n")

local input = arg[1]
if input==nil then
    print("--")
    return
end

io.input(input)

local isUTF8 = false
local i = 0
for line in io.lines() do
    if i == 0 then
        local a, b, c = line:byte(1, 3);
        if (a == 0xef and b == 0xbb and c == 0xbf) then
            line = line:sub(4);
            isUTF8 = true
        end
    end

    i = i + 1
    if i == 3 then
        break
    end

    if line:sub(1, 6)=="#title" then
        local text = line:sub(7)
        if not isUTF8 then
            text = fa.strconvert("sjis2utf8", text)
        end
        print(text)
        return
    end
end

print("--")
