print("HTTP/1.1 200 OK\nPragma: no-cache\nCache-Control: no-cache\n")

input = arg[1]
input = input:gsub("|"," ")

io.input(input)

for line in io.lines() do
    print(line)
end
