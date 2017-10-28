Tokenizer = {}

function Tokenizer:nextLine(text)
	if self.line == 0 then
        local a, b, c = text:byte(1, 3);
        if (a == 0xef and b == 0xbb and c == 0xbf) then
            text = text:sub(4);
        end
	end
	self.text = text
	self.line = self.line + 1
	self.column = 1
	--print(string.format("%d: '%s'", self.line, text))
end

function Tokenizer:peekChar()
	return string.byte(self.text, self.column)
end

function Tokenizer:getChar()
	local ch = self:peekChar()
	self.column = self.column + 1
	return ch
end

function Tokenizer:skip(n)
	self.column = self.column + n;
end

function Tokenizer:returnToken(s)
	if s then
		self.buf[#self.buf + 1] = s
	end
end

function Tokenizer:getToken(enableSign)
	--print("getToken:"..self.line..":"..self.column)
	if #self.buf > 0 then
		local r = self.buf[#self.buf]
		self.buf[#self.buf] = nil
		return r
	end
	
	local r = ""
	local numeric = false
	while true do
		local ch = self:getChar()
		if ch == nil then
			return r
		end
		
		if ch > 0x20 then
			if (ch >= 0x30 and ch <= 0x39) or	-- 0-9
				(enableSign and
					(string.len(r) == 0 and
						(ch == 0x2d or 			--'-'
						 ch == 0x2b))) then		--'+'
				numeric = true
				r = r..string.char(ch)
			else
				if numeric then
					self.column = self.column - 1
					return r
				end
				return string.char(ch)
			end
		end
	end
end

function Tokenizer:getString()
	local r = ""
	while true do
		local ch = self:getChar()
		if ch == nil then
			return ""
		end
		if ch <= 0x20 then
			if string.len(r) ~= 0 then
				return r
			end
		else
			r = r..string.char(ch)
		end
	end
end

function Tokenizer:getLeftLine()
	while true do
		local ch = self:peekChar()
		if ch == nil then
			return ""
		end 
		if ch > 0x20 then
			break
		end
		self.skip(1)
	end
	return string.sub(self.text, self.column)
end

function Tokenizer:getVector()
	local r = {}
	while true do
		if #r > 0 then
			local tk = self:getToken()
			if tk ~= "," then
				self:returnToken(tk)
				return r
			end
		end
		local tk = self:getToken(true)
		local v = tonumber(tk)
		if v then 
			r[#r + 1] = v
		else
			return nil
		end
	end
end


function Tokenizer.new()
	local obj = {}
	obj.buf = {}
	obj.line = 0
	obj.column = 1
	obj.text = ""
	return setmetatable(obj, {__index = Tokenizer})
end


