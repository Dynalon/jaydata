function ODataQueryRequest() {
    //this.expand =      "";
    this.filter =      "";
    this.orderby =     "";
    this.skip =        "";
    this.top =         "";
    this.format =      "";
    //this.inlinecount = "";
    this.select =      "";
}
function ODataRequestParser() {
    this.req = null;
    this.lexer = null;
    this.builder = new ODataExpressionBuilder();
}
ODataRequestParser.prototype.parse = function(req) { // req : ODataQueryRequest
    this.req = req;
    this.parseFilterExpr();
    this.parseOrderByExpr();
    this.parseSkipExpr();
    this.parseTopExpr();
    this.parseInlineCountExpr();
    this.parseExpandExpr();
    this.parseFormatExpr();
    this.parseSelectExpr();
};

ODataRequestParser.prototype.parseFilterExpr = function() {
    this.lexer = new ODataRequestLexer(this.req.filter);
    var expr = this.parseExpr();
    var token = this.lexer.token;
    if(token && token.tokenType != TokenType.EOF) {
        var tokenType;
        for(var key in TokenType)
            if(TokenType[tokenType=key] == token.tokenType)
                break;
        SyntaxError.call(this, "Unexpected "+tokenType+" in $filter: '"+token.value+"'.", "parseFilterExpr");
    }
    this.req.filter = expr;
};
ODataRequestParser.prototype.parseOrderByExpr = function() {
    this.lexer = new ODataRequestLexer(this.req.orderby);
    var expr = this.parseOrderBy();
    var token = this.lexer.token;
    if(token && token.tokenType != TokenType.EOF) {
        var tokenType;
        for(var key in TokenType)
            if(TokenType[tokenType=key] == token.tokenType)
                break;
        SyntaxError.call(this, "Unexpected "+tokenType+" in $orderby: '"+token.value+"'.", "parseOrderByExpr");
    }
    this.req.orderby = expr;
};
ODataRequestParser.prototype.parseSkipExpr = function() {
    this.req.skip = parseInt(this.req.skip);
};
ODataRequestParser.prototype.parseTopExpr = function() {
    this.req.top = parseInt(this.req.top);
};
ODataRequestParser.prototype.parseInlineCountExpr = function() {
    //TODO: parseInlineCountExpr
};
ODataRequestParser.prototype.parseExpandExpr = function() {
    //TODO: parseExpandExpr
};
ODataRequestParser.prototype.parseFormatExpr = function() {
    //TODO: parseFormatExpr
};
ODataRequestParser.prototype.parseSelectExpr = function() {
    //TODO: parseSelectExpr
};

function SyntaxError(reason, caller) {
    var src = this.lexer.src;
    var token = this.lexer.token;
    var line = " Source:"+src.substr(0, token.column) + ">>>>"+src.substr(token.column, 1)+"<<<<"+src.substr(token.column+1);
    var msg = "Syntax error at line "+token.line+", char "+token.column+". "+reason+line;
    if(caller)
        msg+=". Caller: "+caller;
    throw {message:msg,reason:reason,source:caller,line:token.line,column:token.column};
}
/***************************************************     BNF    *****************************************************/
ODataRequestParser.prototype.functionNames = [
    //string
    "substringof","endswith","startswith","length","indexof","replace","substring","tolower","toupper","trim","concat",
    //Date
    "day","hour","minute","month","second","year",
    //Math
    "round","floor","ceiling",
    //Type
    "IsOf"
];
ODataRequestParser.prototype.functionTypes = [
    //string
    "boolean","boolean","boolean","int","int","string","string","string","string","string","string",
    //Date
    "int","int","int","int","int","int",
    //Math
    "number","number","number",
    //Type
    "boolean"
];
ODataRequestParser.prototype.parseExpr = function() {
    //bnf: Expr               : OrExpr;
    return this.parseOrExpr();
};
ODataRequestParser.prototype.parseOrExpr = function() {
    //bnf: OrExpr             : AndExpr | OrExpr "or" AndExpr;
    var expr = this.parseAndExpr();
    if (this.lexer.token.value == "or") {
        this.lexer.nextToken();
        var right = this.parseOrExpr();
        expr = this.builder.buildSimpleBinary(expr, right, "or", "or");
    }
    return expr;
};
ODataRequestParser.prototype.parseAndExpr = function() {
    //bnf: AndExpr            : EqualityExpr | AndExpr "and" EqualityExpr;
    var expr = this.parseEqualityExpr();
    if (this.lexer.token.value == "and") {
        this.lexer.nextToken();
        var right = this.parseAndExpr();
        expr = this.builder.buildSimpleBinary(expr, right, "and", "and");
    }
    return expr;
};
ODataRequestParser.prototype.parseEqualityExpr = function() {
    //bnf: EqualityExpr       : RelationalExpr | EqualityExpr "eq" RelationalExpr | EqualityExpr "ne" RelationalExpr;
    var expr = this.parseRelationalExpr();
    var token = this.lexer.token;
    if (token.value == "eq" || token.value == "ne" ) {
        this.lexer.nextToken();
        var right = this.parseEqualityExpr();
        expr = this.builder.buildSimpleBinary(expr, right, token.value, token.value);
    }
    return expr;
};
ODataRequestParser.prototype.parseRelationalExpr = function() {
    //bnf: RelationalExpr     : AdditiveExpr | RelationalExpr "lt" AdditiveExpr | RelationalExpr "gt" AdditiveExpr | RelationalExpr "le" AdditiveExpr | RelationalExpr "ge" AdditiveExpr;
    var expr = this.parseAdditiveExpr();
    var token = this.lexer.token;
    if (token.value == "lt" || token.value == "gt" || token.value == "le" || token.value == "ge" ) {
        this.lexer.nextToken();
        var right = this.parseRelationalExpr();
        expr = this.builder.buildSimpleBinary(expr, right, token.value, token.value);
    }
    return expr;
};
ODataRequestParser.prototype.parseAdditiveExpr = function() {
    //bnf: AdditiveExpr       : MultiplicativeExpr | AdditiveExpr "add" MultiplicativeExpr | AdditiveExpr "sub" MultiplicativeExpr;
    var expr = this.parseMultiplicativeExpr();
    var token = this.lexer.token;
    if (token.value == "add" || token.value == "sub" ) {
        this.lexer.nextToken();
        var right = this.parseAdditiveExpr();
        expr = this.builder.buildSimpleBinary(expr, right, token.value, token.value);
    }
    return expr;
};
ODataRequestParser.prototype.parseMultiplicativeExpr = function() {
    //bnf: MultiplicativeExpr : UnaryExpr | MultiplicativeExpr "mul" UnaryExpr | MultiplicativeExpr "div"  UnaryExpr | MultiplicativeExpr "mod" UnaryExpr;
    var expr = this.parseUnaryExpr();
    var token = this.lexer.token;
    if (token.value == "mul" || token.value == "div" || token.value == "mod" ) {
        this.lexer.nextToken();
        var right = this.parseMultiplicativeExpr();
        expr = this.builder.buildSimpleBinary(expr, right, token.value, token.value);
    }
    return expr;
};
ODataRequestParser.prototype.parseUnaryExpr = function() {
    //bnf: UnaryExpr          : PrimaryExpr | "-" UnaryExpr | "not" UnaryExpr;
    var expr = this.parsePrimaryExpr();
    if (expr != null)
        return expr;
    var token = this.lexer.token;
    if (token.value == "-") {
        this.lexer.nextToken();
        expr = this.parseUnaryExpr();
        //TODO: parseUnaryExpr: build negation and return with it
        return null; 
    }
    if (token.value == "not") {
        this.lexer.nextToken();
        expr = this.parseUnaryExpr();
        //TODO: parseUnaryExpr: build "not" and return with it
        return null;
    }
};
ODataRequestParser.prototype.parsePrimaryExpr = function() {
    //bnf: PrimaryExpr        : ParenExpr | LiteralExpr | FunctionCall | MemberPath
    var expr;
    if (expr=this.parseParenExpr())    return expr;
    if (expr=this.parseLiteralExpr())  return expr;
    if (expr=this.parseFunctionCall()) return expr;
    if (expr=this.parseMemberPath())   return expr;
    return null;
};
ODataRequestParser.prototype.parseParenExpr = function() {
    //bnf: ParenExpr          : "(" Expr ")"
    if (this.lexer.token.value != ASCII.LPAREN)
        return null;
    this.lexer.nextToken();
    var expr = this.parseExpr();
    if (this.lexer.token.value != ASCII.RPAREN)
        SyntaxError.call(this, "Expected ')'.", "parseParenExpr");
    this.lexer.nextToken();
    return expr;
};
ODataRequestParser.prototype.parseLiteralExpr = function() {
    //bnf: LiteralExpr        : DatetimeLiteral | StringLiteral | BoolLiteral | NumberLiteral
    var expr;
    if (expr=this.parseDatetimeLiteral()) return expr;
    if (expr=this.parseStringLiteral()) return expr;
    if (expr=this.parseBoolLiteral())   return expr;
    if (expr=this.parseNumberLiteral()) return expr;
    return null;
};
ODataRequestParser.prototype.parseDatetimeLiteral = function() {
    //bnf: DatetimeLiteral    : "datetime" "'" DIGITS "-" DIGITS "-" DIGITS [ "T" DIGITS ":" DIGITS ":" DIGITS [ "." DIGITS ] [ ( SIGN ) DIGITS ":" DIGTS ] [ "Z" ]
    //example: datetime'2010-07-15'
    //         datetime'2010-07-15T16:19:54Z'.
    //         datetime'2011-06-07T13:18:25.0348565-07:00'
    if (this.lexer.token.value != "datetime")
        return null;
    this.lexer.nextToken();
    var token = this.lexer.token;
    if(token.tokenType != TokenType.STRING)
        SyntaxError.call(this, "Invalid date format.", "parseDatetimeLiteral");
    var d;
    try {
        d = new Date(token.value)
    }catch(e) {
        SyntaxError.call(this, "Invalid date format.", "parseDatetimeLiteral");
    }
    this.lexer.nextToken();
    return this.builder.buildConstant(d, "datetime");
};
ODataRequestParser.prototype.parseStringLiteral = function() {
    //bnf: StringLiteral      : STRING
    if (this.lexer.token.tokenType != TokenType.STRING)
        return null;
    var v = this.lexer.token.value;
    this.lexer.nextToken();
    return this.builder.buildConstant(v, "string");
};
ODataRequestParser.prototype.parseBoolLiteral = function() {
    //bnf: BoolLiteral        : "true" | "false" | "0" | "1"
    var v = this.lexer.token.value;
    if (v=="true"/*||v=="1"*/) {
        this.lexer.nextToken();
        return this.builder.buildConstant(true, typeof true);
    }
    if (v=="false"/*||v=="0"*/) {
        this.lexer.nextToken();
        return this.builder.buildConstant(false, typeof false);
    }
    return null;
};
ODataRequestParser.prototype.parseNumberLiteral = function() {
    //bnf: NumberLiteral      : [ Sign ] 1*DIGIT [ "." 1*DIGIT ] [ "E" [ Sign ] 1*DIGIT ] [ "M" | "m" ] |  //double
    //bnf:                      [ Sign ] 1*DIGIT [ "." 1*DIGIT ] [ "f" ]                                |  //single
    //bnf:                      [ Sign ] 1*DIGIT [ "L" ]                                                   //long
    var sign1, sign2, digits1, digits2, digits3;
    sign1 = this.parseSign();
    var v = sign1 ? String.fromCharCode(sign1) : "";
    var token = this.lexer.token;
    if (token.tokenType != TokenType.DIGITS) {
        if (sign1 == null)
            return null;
        SyntaxError.call(this, "Expected DIGITS (after Sign1).", "parseDoubleStrict");
    }
    digits1 = token.value;
    v += digits1;
    this.lexer.nextToken();
    token = this.lexer.token;
    if(token.value == "L"){
        this.lexer.nextToken();
        return this.builder.buildConstant(v, "number"); // long
    }
    if (token.value == ASCII.DOT) {
        this.lexer.nextToken();
        token = this.lexer.token;
        if (token.tokenType != TokenType.DIGITS)
            SyntaxError.call(this, "Expected DIGITS (after '.').", "parseDoubleStrict");
        digits2 = token.value;
        v += "." + digits2;
        this.lexer.nextToken();
        token = this.lexer.token;
    }
    if(token.value=="f"){
        this.lexer.nextToken();
        return this.builder.buildConstant(v, "number"); // single
    }
    if (token.value == "e") {
        this.lexer.nextToken();
        sign2 = this.parseSign();
        token = this.lexer.token;
        if (token.tokenType != TokenType.DIGITS)
            SyntaxError.call(this, "Expected DIGITS (after Sign2).", "parseDoubleStrict");
        digits3 = token.value;
        v += "e" + (sign2 ? String.fromCharCode(sign2) : "") + digits3;
        this.lexer.nextToken();
        token = this.lexer.token;
    }
    if(token.value=="m" || token.value=="M"){
        this.lexer.nextToken();
    }
    return this.builder.buildConstant(v, "number"); // double
};
ODataRequestParser.prototype.parseSign = function() { // returns "+", "-" or null
    //bnf: Sign          : "+" | "-"
    var token = this.lexer.token;
    if (token.value != ASCII.PLUS && token.value != ASCII.MINUS)
        return null;
    this.lexer.nextToken();
    return token.value;
};
ODataRequestParser.prototype.parseFunctionCall = function() {
    //bnf: FunctionCall       : FunctionName "(" [ Arguments ] ")";
    var fn = this.parseFunctionName();
    if (fn == null)
        return null;
    var token = this.lexer.token;
    if (token.value != ASCII.LPAREN)
        SyntaxError.call(this, "Expected '('.", "parseFunctionCall");
    this.lexer.nextToken();
    token = this.lexer.token;
    var args;
    if (token.value != ASCII.RPAREN) {
        args = this.parseArguments();
        token = this.lexer.token;
    }
    if (token.value != ASCII.RPAREN)
        SyntaxError.call(this, "Expected ')'.", "parseFunctionCall");
    this.lexer.nextToken();

    return this.builder.buildGlobalCall(fn.type, fn.name, args);
};
ODataRequestParser.prototype.parseFunctionName = function() { //returns {name:, type:}
    //bnf: FunctionName       : "startswith" | "endswith" | ...;
    var token = this.lexer.token;
    if (token.tokenType != TokenType.WORD)
        return;
    var name = token.value;
    for(var i=0;i<this.functionNames.length;i++) {
        if(this.functionNames[i] == name) {
            this.lexer.nextToken();
            return {name:name, type:this.functionTypes[i]};
        }
    }
    return null;
};
ODataRequestParser.prototype.parseArguments = function() {
    //bnf: Arguments          : Argument | Arguments "," Argument;
    var args = [];
    while(true) {
        var expr = this.parseArgument();
        if(!expr)
            SyntaxError.call(this, "Expected: expression", "parseArguments");
        args.push(expr);
        if (this.lexer.token.value != ASCII.COMMA)
            break;
        this.lexer.nextToken();
    }
    return args;
};
ODataRequestParser.prototype.parseArgument = function() {
    //bnf: Argument           : Expr;
    return this.parseExpr();
};
ODataRequestParser.prototype.parseMemberPath = function() {
    //bnf: MemberPath         : [ Namespace "/" ] *(NavigationProperty "/") Field
    //bnf: Namespace          : NAME *("." NAME)
    //bnf: NavigationProperty : NAME
    //bnf: Field              : NAME
    //short: MemberPath         : [ Name *("." Name) "/" ] *(Name "/") Name
    var name = this.parseName();
    var token = this.lexer.token;
    if (!name) {
        var msg = "Expected: member";
        if (token.value == ASCII.DOT)
            msg += " or DIGIT";
        msg += " before dot ('.').";
        SyntaxError.call(this, msg, "parseMemberPath");
    }
    var member = name;

    var hasDot = false;
    while (token.value == ASCII.DOT) {
        member += ".";
        hasDot = true;
        this.lexer.nextToken();
        name = this.parseName();
        token = this.lexer.token;
        if (!name)
            SyntaxError.call(this, "Expected: name after dot ('.').", "parseMemberPath");
        member += name;
    }
    var steps = [];
    steps.push(member);

    var hasSlash = false;
    while (token.value == ASCII.SLASH) {
        member += "/";
        hasSlash = true;
        this.lexer.nextToken();
        name = this.parseName();
        token = this.lexer.token;
        if (!name)
            SyntaxError.call(this, "Expected: name.", "parseMemberPath");
        member += name;
        steps.push(name);
    }
    if (hasDot && !hasSlash)
        SyntaxError.call(this, "Expected: / after namespace.", "parseMemberPath");
    if(this.lexer.token.value != ASCII.LPAREN)
        return this.builder.buildMemberPath(/*member*/ steps); //TODO: buildMemberPath: expression chain instead of a path in string
    //-- parse instance method
    this.lexer.nextToken();
    if(this.lexer.token.value != ASCII.RPAREN)
        SyntaxError.call(this, "Expected: right parenthesis: ')'.", "parseMemberPath");
    this.lexer.nextToken();
    return this.builder.buildMemberPath(/*member*/ steps); //TODO: buildMemberPath: expression chain instead of a path in string
};
ODataRequestParser.prototype.parseName = function() {
    //bnf: Name               : (WORD | UNDERSCORE) *(WORD | UNDERSCORE | DIGIT)
    //HACK: this and getNextNamePart are not a clean parser function
    var token = this.lexer.token;
    if (token.tokenType != TokenType.WORD && token.value != ASCII.UNDERSCORE)
        return null;
    var name = token.toString() + this.getNextNamePart();
    this.lexer.nextToken();
    return name;
};
ODataRequestParser.prototype.getNextNamePart = function() {
    var part = "";
    var c = this.lexer.currentChar;
    var ct = this.lexer.currentCharType;
    while(ct == CharType.DIGIT || ct == CharType.ALPHA || c == ASCII.UNDERSCORE){
        part+=String.fromCharCode(c);
        this.lexer.nextChar();
        c = this.lexer.currentChar;
        ct = this.lexer.currentCharType;
    }
    return part;
};

//=====================================================================================================================

ODataRequestParser.prototype.parseOrderBy = function() {
    //bnf: OrderByExpr:     [ "asc" | "desc"] *( "," MemberPath [ "asc" | "desc"] )
    var member = this.parseMemberPath();
    if(!member)
        return null;
    var items = [];  // [{prop:member, dir:"asc"}]
    var dir = "asc";
    var token = this.lexer.token;
    if(token.value == "asc" || token.value == "desc") {
        dir = token.value;
        this.lexer.nextToken();
        token = this.lexer.token;
    }
    items.push({prop:member,dir:dir});

    while(token.value == ASCII.COMMA){
        this.lexer.nextToken();
        token = this.lexer.token;
        member = this.parseMemberPath();
        if(!member)
            SyntaxError.call(this, "Expected: member", "parseOrderBy");
        dir = "asc";
        token = this.lexer.token;
        if(token.value == "asc" || token.value == "desc") {
            dir = token.value;
            this.lexer.nextToken();
            token = this.lexer.token;
        }
        items.push({prop:member,dir:dir});
    }

    return this.builder.buildOrderBy(items);
};