/**
 * Copyright (C) 2014 Glayzzle (BSD3 License)
 * @authors https://github.com/glayzzle/php-parser/graphs/contributors
 * @url http://glayzzle.com
 */
var fs = require('fs');
var cmd = require('./cmd');

module.exports = {
  handles: function(filename, ext) {
    if (ext == '.out') {
      fs.unlink(filename);
      return false;
    }
    return filename.indexOf("/token/") > -1 && (
      ext == '.php'
      || ext == '.phtml'
      || ext == '.html'
    );
  }
  ,run: function(filename, engine) {

    // USING THE LEXER TO PARSE THE FILE :
    var EOF = engine.lexer.EOF;
    engine.lexer.mode_eval = false;
    engine.lexer.all_tokens = true;
    engine.lexer.setInput(fs.readFileSync(filename, {
      encoding: 'binary'
    }).toString());
    var token = engine.lexer.lex() || EOF;
    var names = engine.tokens.values;
    var jsTok = [];
    while(token != EOF) {
      var entry = engine.lexer.yytext;
      if (names[token]) {
        entry = [names[token], entry, engine.lexer.yylloc.first_line];
      }
      jsTok.push(entry);
      token = engine.lexer.lex() || EOF;
    }  

    // USING THE PHP ENGINE TO PARSE
    var result = cmd.exec('php ' + __dirname + '/token.php ' + filename);
    var phpTok = JSON.parse(result.stdout);
    var fail = false;
    var error = [[], []];

    // CHECK ALL TOKENS
    for(var i = 0; i < phpTok.length; i++) {
      var p = phpTok[i];
      var j = jsTok[i];
      if ( p instanceof Array ) {
        if ( j instanceof Array ) {
          if (p[0] != j[0]) { // check the token type
            if (
              (p[0] == 'T_LNUMBER' || p[0] == 'T_DNUMBER')
              && (j[0] == 'T_LNUMBER' || j[0] == 'T_DNUMBER')
            ) {
              // @fixme : ignore numbers size - long are not handled in same way
            } else {
              console.log('FAIL : Expected ' + p[0] + ' token, but found ' + j[0]);
              fail = true;
            }
          }
          if (p[1] != j[1]) { // check the token contents
            j[1] = JSON.parse( JSON.stringify( j[1] ) );
            console.log('FAIL : Expected "' + p[1] + '" contents, but found "' + j[1] + '"');
            fail = true;
          }
          if (p[2] != j[2]) { // check the token line
            console.log('FAIL : Expected line ' + p[2] + ', but found ' + j[2]);
            // @todo fixme fail = true; 
          }
        } else {
          console.log('FAIL : Expected ' + p[0] + ' token, but found "' + j + '" symbol');
          fail = true;
        }
      } else {
        if ( j !== p ) {
          console.log('FAIL : Expected "' + p + '", but found "' + j + '"');
          fail = true;
        }
      }
      if (fail) {
        error[0].push(j);
        error[1].push(p);
        break;
      }
    }

    // OUTPUT ERRORS IF FOUND
    if (phpTok.length != jsTok.length) {
      console.log('FAIL : Token arrays have not the same length !');
      fail = true;
    }
    if (fail) {
      console.log('\nError at : ' + filename);
      console.log('\nJS Tokens', error[0]);
      console.log('PHP Tokens', error[1]);
      // ADD A LOG FILE (FOR ANALYSIS)
      fs.writeFileSync(
        filename + '.out',
        JSON.stringify(jsTok)
        + "\n\n" + JSON.stringify(phpTok)
      );
      return false;
    } else {
      console.log('v - Passed ' + jsTok.length + ' tokens');
      return true;
    }
  }
};