$(document).ready(function() {

  var numOfInfoCols = 18; // => The "select" cell has index numOfInfoCols
  var currentCurrency = "USD";
  var refreshInterval = 60; // Refresh Interval (in seconds)
  var validDataObject = {}; // The main data object (only succesfully received data)

  // Add coin options in "select" lists - coinCodes defined in the bottom of the page
  $.each(coinCodes, function (i, coinCode) {
    $('#crypto-quotes-table select').append($('<option>', { 
      value: coinCode,
      text : coinCode 
    }));
  });

  // Dynamic Rows Code
  $("#add_row").on("click", function() {
    var row = $('#crypto-quotes-table.table tbody>tr:first').clone(true); 
    row.removeClass("hidden");
    row.insertAfter('#crypto-quotes-table.table tbody>tr:last');        
  });

  // Delete Row
  $("#crypto-quotes-table tbody").on("click", "td button.row-remove", function() {
    var optionValue = $(this).parent().prev().children("select").val();
    if(optionValue!="") { delete validDataObject[optionValue]; }
    $(this).closest("tr").remove();
  });

  // Dropdown currency click
  $(".dropdown-menu li a").click(function(event) {
    var clickedCurrency = event.target.id.substr(0,3).toUpperCase();
    if($("button.dropdown-toggle").text().trim()!=clickedCurrency) {
      currentCurrency = clickedCurrency;
      $("button.dropdown-toggle").html(currentCurrency + ' <span class="caret"></span>');    
      clearDataAnalysis(); 
      for(var i=1; i<$("#crypto-quotes-table tbody tr").length; i++) { // Loop through rows and recalculate
        var currentValue = $("#crypto-quotes-table tbody tr").eq(i).children().eq(numOfInfoCols).children().eq(0).val();
        $("#crypto-quotes-table tbody tr").eq(i).children().eq(numOfInfoCols).children().eq(0).val(currentValue).change();
      }       
    }
  });

  // On change event
  $("#crypto-quotes-table tbody").on("change", "td select", function(event) {
    var coin = $(this).val();
    var previousCoin = $(this).attr("data-current-coin");

    var currentSiblings = $(this).parent().siblings(); // td siblings of row
    currentSiblings.each(function(index){
      if(index===0) {
        if(coin!=previousCoin){ $(this).text(""); }
      }
      if(index>0 && index<numOfInfoCols){
        $(this).text("");
      }
    });   
    if(coin) {
      if(coin!=previousCoin) {
        if(!validDataObject[coin]) { // New Coin => should be added to validDataObject
          if(previousCoin!="") { delete validDataObject[previousCoin]; }
          validDataObject[coin] = {
            currency: currentCurrency,
            fullName: "",
            buyPricesArray:[],
            sellPricesArray:[]
          }
        }
        else {
          if(validDataObject[coin].currency!=currentCurrency) { validDataObject[coin].currency = currentCurrency; }
          validDataObject[coin].buyPricesArray = [];
          validDataObject[coin].sellPricesArray = [];         
        }
      }
      else {
        if(validDataObject[coin].currency!=currentCurrency) { validDataObject[coin].currency = currentCurrency; }
        validDataObject[coin].buyPricesArray = [];
        validDataObject[coin].sellPricesArray = [];
      }      
      // coincap
      var coincapURL = "https://coincap.io/page/" + coin;
      $.get(coincapURL, function(data) {
        var coincapData = data;
        if(data){
          // console.log(data);
          // currentSiblings.eq(17).text(Math.round(Number(data.price_usd) * 10000) / 10000);          
          if(coin!=previousCoin) { currentSiblings.eq(0).text(data.display_name);  validDataObject[coin].fullName = data.display_name; }
          if(currentCurrency=="EUR" && !data.price_eur) {
            currentSiblings.eq(17).text("N/A");
          }
          else if(currentCurrency=="BTC" && !data.price_btc) {
            currentSiblings.eq(17).text("N/A");
          }          
          else {
            currentSiblings.eq(17).text(Number(currentCurrency=="USD" ? data.price_usd : (currentCurrency=="EUR" ? data.price_eur : data.price_btc)).toFixed(currentCurrency=="BTC" ? 5 : 4));        
          }
        }
        else {
          currentSiblings.eq(17).text("N/A");
        }   
      })
      .fail(function() {
        currentSiblings.eq(17).text("N/A");  
      });      

      if(currentCurrency===coin) { // Add 1s (instead of N/A) in the case where currentCurrency===coin
        currentSiblings.each(function(index) {
          if(index>0 && index<numOfInfoCols-1) {
            $(this).text("1.00000");
          }
          if(index%2!=0) {
            validDataObject[coin].buyPricesArray.push({provider: "", price: Number(1)});
          }
          else {
            validDataObject[coin].sellPricesArray.push({provider: "", price: Number(1)});
          }
        });
        recalulateMaxProfit(validDataObject, coin); 
      }
      else { // Only proceed if currentCurrency!=coin
        // bitstamp
        var bitstampURL = "https://www.bitstamp.net/api/v2/ticker/" + coin.toLowerCase() + currentCurrency.toLowerCase() + "/";
        var proxyURL = "https://cors-anywhere.herokuapp.com/"; // This is in order to bypass the 'Access-Control-Allow-Origin' error
        $.get(proxyURL + bitstampURL, function(data) {
          if(data){
            // console.log(data);
            currentSiblings.eq(5).text(Number(data.ask).toFixed(currentCurrency=="BTC" ? 5 : 2));
            currentSiblings.eq(6).text(Number(data.bid).toFixed(currentCurrency=="BTC" ? 5 : 2));
            validDataObject[coin].buyPricesArray.push({provider: "Bitstamp", price: Number(data.ask)});
            validDataObject[coin].sellPricesArray.push({provider: "Bitstamp", price: Number(data.bid)});
            recalulateMaxProfit(validDataObject, coin);
          }
          else {
            currentSiblings.eq(5).text("N/A");
            currentSiblings.eq(6).text("N/A");            
          }
        })
        .fail(function() {
          currentSiblings.eq(5).text("N/A");
          currentSiblings.eq(6).text("N/A");  
        });        

        // kraken    
        var krakenURL = "https://api.kraken.com/0/public/Ticker?pair=" + coin.toUpperCase() + currentCurrency.toUpperCase();
        var proxyURL = "https://cors-anywhere.herokuapp.com/"; // This is in order to bypass the 'Access-Control-Allow-Origin' error
        $.get(proxyURL + krakenURL, function(data) {
          if(data){
            if(data.error.length===0) {
              currentSiblings.eq(3).text(Number(data.result[Object.keys(data.result)[0]].a[0]).toFixed(currentCurrency=="BTC" ? 5 : 2));
              currentSiblings.eq(4).text(Number(data.result[Object.keys(data.result)[0]].b[0]).toFixed(currentCurrency=="BTC" ? 5 : 2));
              validDataObject[coin].buyPricesArray.push({provider: "Kraken", price: Number(data.result[Object.keys(data.result)[0]].a[0])});
              validDataObject[coin].sellPricesArray.push({provider: "Kraken", price: Number(data.result[Object.keys(data.result)[0]].b[0])});     
              recalulateMaxProfit(validDataObject, coin);       
              
            }
            else {
              currentSiblings.eq(3).text("N/A");
              currentSiblings.eq(4).text("N/A");
            }          
          }
          else {
            currentSiblings.eq(3).text("N/A");
            currentSiblings.eq(4).text("N/A");
          }
        })
        .fail(function() {
          currentSiblings.eq(3).text("N/A");
          currentSiblings.eq(4).text("N/A");  
        });        

        // coinbase    
        var coinbaseURL1 = "https://api.coinbase.com/v2/prices/" + coin.toUpperCase() + "-" + currentCurrency.toUpperCase() + "/buy";
        var coinbaseURL2 = "https://api.coinbase.com/v2/prices/" + coin.toUpperCase() + "-" + currentCurrency.toUpperCase() + "/sell";
        var proxyURL = "https://cors-anywhere.herokuapp.com/"; // This is in order to bypass the 'Access-Control-Allow-Origin' error
        $.get(proxyURL + coinbaseURL1, function(data) {
          if(data){
            // console.log(data);
            currentSiblings.eq(1).text(Number(data.data.amount).toFixed(currentCurrency=="BTC" ? 5 : 2));
            validDataObject[coin].buyPricesArray.push({provider: "Coinbase", price: Number(data.data.amount)});    
            recalulateMaxProfit(validDataObject, coin);     
          }
          else {
            currentSiblings.eq(1).text("N/A");
          }
        })
        .fail(function() {
          currentSiblings.eq(1).text("N/A"); 
        });
        $.get(proxyURL + coinbaseURL2, function(data) {
          if(data){
            currentSiblings.eq(2).text(Number(data.data.amount).toFixed(currentCurrency=="BTC" ? 5 : 2)); 
            validDataObject[coin].sellPricesArray.push({provider: "Coinbase", price: Number(data.data.amount)});      
            recalulateMaxProfit(validDataObject, coin);       
          }
          else {
            currentSiblings.eq(2).text("N/A");
          }
        })
        .fail(function() {
          currentSiblings.eq(2).text("N/A"); 
        });
   
        // binance     
        var binanceURL = "https://api.binance.com/api/v3/ticker/bookTicker?symbol=" + coin.toUpperCase() + currentCurrency.toUpperCase() + (currentCurrency==="USD" ? "T" : "");
        var proxyURL = "https://cors-anywhere.herokuapp.com/"; // This is in order to bypass the 'Access-Control-Allow-Origin' error
        $.get(proxyURL + binanceURL, function(data) {
          // console.log(data);
          if(data){
            currentSiblings.eq(7).text(Number(data.askPrice).toFixed(currentCurrency=="BTC" ? 5 : 2));
            currentSiblings.eq(8).text(Number(data.bidPrice).toFixed(currentCurrency=="BTC" ? 5 : 2));
            validDataObject[coin].buyPricesArray.push({provider: "Binance", price: Number(data.askPrice)});
            validDataObject[coin].sellPricesArray.push({provider: "Binance", price: Number(data.bidPrice)}); 
            recalulateMaxProfit(validDataObject, coin);             
          }
          else {
            currentSiblings.eq(7).text("N/A");
            currentSiblings.eq(8).text("N/A");
          }
        })
        .fail(function() {
          currentSiblings.eq(7).text("N/A");
          currentSiblings.eq(8).text("N/A");  
        });        

        // poloniex      
        var poloniexURL = "https://poloniex.com/public?command=returnTicker";
        $.get(poloniexURL, function(data) {
          // console.log(data);
          if(data){
            var currencyPair = currentCurrency.toUpperCase() + (currentCurrency==="USD" ? "T" : "") + "_"  + coin.toUpperCase();
            if(data[currencyPair]){
              currentSiblings.eq(9).text(Number(data[currencyPair].lowestAsk).toFixed(currentCurrency=="BTC" ? 5 : 2));
              currentSiblings.eq(10).text(Number(data[currencyPair].highestBid).toFixed(currentCurrency=="BTC" ? 5 : 2));   
              validDataObject[coin].buyPricesArray.push({provider: "Poloniex", price: Number(data[currencyPair].lowestAsk)});
              validDataObject[coin].sellPricesArray.push({provider: "Poloniex", price: Number(data[currencyPair].highestBid)});    
              recalulateMaxProfit(validDataObject, coin);                   
            }
            else {
              currentSiblings.eq(9).text("N/A");
              currentSiblings.eq(10).text("N/A");            
            }
          }
          else {
            currentSiblings.eq(9).text("N/A");
            currentSiblings.eq(10).text("N/A");
          }
        })
        .fail(function() {
          currentSiblings.eq(9).text("N/A");
          currentSiblings.eq(10).text("N/A");  
        });

        // bitfinex     
        var bitfinexURL = "https://api.bitfinex.com/v1/pubticker/" + coin.toLowerCase() + currentCurrency.toLowerCase();
        var proxyURL = "https://cors-anywhere.herokuapp.com/"; // This is in order to bypass the 'Access-Control-Allow-Origin' error
        $.get(proxyURL + bitfinexURL, function(data) {
          if(data){
            // console.log(data);
            currentSiblings.eq(11).text(Number(data.ask).toFixed(currentCurrency=="BTC" ? 5 : 2));
            currentSiblings.eq(12).text(Number(data.bid).toFixed(currentCurrency=="BTC" ? 5 : 2));    
            validDataObject[coin].buyPricesArray.push({provider: "Bitfinex", price: Number(data.ask)});
            validDataObject[coin].sellPricesArray.push({provider: "Bitfinex", price: Number(data.bid)}); 
            recalulateMaxProfit(validDataObject, coin);              
          }
          else {
            currentSiblings.eq(11).text("N/A");
            currentSiblings.eq(12).text("N/A");            
          }
        })
        .fail(function() {
          currentSiblings.eq(11).text("N/A");
          currentSiblings.eq(12).text("N/A");  
        });        

        // hitbtc
        var hitbtcURL = "https://api.hitbtc.com/api/2/public/ticker/" + coin.toUpperCase() + ((currentCurrency.toUpperCase()==="USD" && (coin.toUpperCase()==="XRP" || coin.toUpperCase()==="BTX" || coin.toUpperCase()==="CAPP")) ? "USDT" : currentCurrency.toUpperCase());
        var proxyURL = "https://cors-anywhere.herokuapp.com/"; // This is in order to bypass the 'Access-Control-Allow-Origin' error
        $.get(proxyURL + hitbtcURL, function(data) {
          if(data){
            // console.log(data);
            currentSiblings.eq(13).text(Number(data.ask).toFixed(currentCurrency=="BTC" ? 5 : 2));
            currentSiblings.eq(14).text(Number(data.bid).toFixed(currentCurrency=="BTC" ? 5 : 2));   
            validDataObject[coin].buyPricesArray.push({provider: "Hitbtc", price: Number(data.ask)});
            validDataObject[coin].sellPricesArray.push({provider: "Hitbtc", price: Number(data.bid)}); 
            recalulateMaxProfit(validDataObject, coin);                 
          }
          else {
            currentSiblings.eq(13).text("N/A");
            currentSiblings.eq(14).text("N/A");            
          }
        })
        .fail(function() {
          currentSiblings.eq(13).text("N/A");
          currentSiblings.eq(14).text("N/A");  
        });         
       
        // gemini   
        var geminiURL = "https://api.gemini.com/v1/pubticker/" + coin.toLowerCase() + currentCurrency.toLowerCase();
        var proxyURL = "https://cors-anywhere.herokuapp.com/"; // This is in order to bypass the 'Access-Control-Allow-Origin' error
        $.get(proxyURL + geminiURL, function(data) {
          if(data){
            // console.log(data);
            currentSiblings.eq(15).text(Number(data.ask).toFixed(currentCurrency=="BTC" ? 5 : 2));
            currentSiblings.eq(16).text(Number(data.bid).toFixed(currentCurrency=="BTC" ? 5 : 2));    
            validDataObject[coin].buyPricesArray.push({provider: "Gemini", price: Number(data.ask)});
            validDataObject[coin].sellPricesArray.push({provider: "Gemini", price: Number(data.bid)});  
            recalulateMaxProfit(validDataObject, coin);            
          }
          else {
            currentSiblings.eq(15).text("N/A");
            currentSiblings.eq(16).text("N/A");            
          }
        })
        .fail(function() {
          currentSiblings.eq(15).text("N/A");
          currentSiblings.eq(16).text("N/A");  
        });             
      } // end of else (i.e. if currentCurrency!=coin)
    } // end of if(coin)
    else { // an empty string was chosen as a coin
      if(previousCoin!="") { delete validDataObject[previousCoin]; }
    }

    $(this).attr("data-current-coin", coin);   

  });  

  // Initiate validDataObject
  validDataObject = {
    BTC: {
      currency: "USD",
      fullName: "",
      buyPricesArray:[],
      sellPricesArray:[]
    },
    ETH: {
      currency: "USD",
      fullName: "",
      buyPricesArray:[],
      sellPricesArray:[]
    },
    LTC: {
      currency: "USD",
      fullName: "",
      buyPricesArray:[],
      sellPricesArray:[]
    },
    XRP: {
      currency: "USD",
      fullName: "",
      buyPricesArray:[],
      sellPricesArray:[]
    },
    BCH: {
      currency: "USD",
      fullName: "",
      buyPricesArray:[],
      sellPricesArray:[]
    }                
  };
  // Initiate 5 first rows
  $("#crypto-quotes-table tbody tr").eq(1).children().eq(numOfInfoCols).children().eq(0).val("BTC").change();
  $("#crypto-quotes-table tbody tr").eq(2).children().eq(numOfInfoCols).children().eq(0).val("ETH").change();
  $("#crypto-quotes-table tbody tr").eq(3).children().eq(numOfInfoCols).children().eq(0).val("LTC").change();
  $("#crypto-quotes-table tbody tr").eq(4).children().eq(numOfInfoCols).children().eq(0).val("XRP").change();
  $("#crypto-quotes-table tbody tr").eq(5).children().eq(numOfInfoCols).children().eq(0).val("BCH").change();

  startTimer(refreshInterval-1); // Initiate countdown

  // Set Interval in order to get new quotes every x minutes
  var requestInterval = setInterval(function(){
    startTimer(refreshInterval-1); 
    for(var i=1; i<$("#crypto-quotes-table tbody tr").length; i++) {
      var currentValue = $("#crypto-quotes-table tbody tr").eq(i).children().eq(numOfInfoCols).children().eq(0).val();
      $("#crypto-quotes-table tbody tr").eq(i).children().eq(numOfInfoCols).children().eq(0).val(currentValue).change();
    }
  }, refreshInterval*1000);

  function startTimer(duration) { // Countdown function - duration(in seconds)
    var timer = duration;
    var minutes;
    var seconds;
    var timeInterval = setInterval(function () {
      minutes = parseInt(timer / 60, 10);
      seconds = parseInt(timer % 60, 10);

      minutes = minutes < 10 ? "0" + minutes : minutes;
      seconds = seconds < 10 ? "0" + seconds : seconds;

      $("#time").text(minutes + ":" + seconds);

      if (--timer < 0) {
        // timer = duration;
        clearInterval(timeInterval);
      }
    }, 1000);
  }

  function recalulateMaxProfit(dataObject, coin) { // Recalculate each time we get a new data point
    if(coin=="BTC" || coin=="ETH" || coin=="LTC" || coin=="XRP" || coin=="BCH") {
      var buyPricesArraySortedAsc = dataObject[coin].buyPricesArray.sort(function(a,b){return a.price - b.price});
      var sellPricesArrayDesc = dataObject[coin].sellPricesArray.sort(function(a,b){return b.price - a.price});
      if(sellPricesArrayDesc[0] && buyPricesArraySortedAsc[0]) { var maxProfitOpportunityNumber = Number(sellPricesArrayDesc[0].price - buyPricesArraySortedAsc[0].price).toFixed(currentCurrency=="BTC" ? 5 : 2) };
      if(sellPricesArrayDesc[0] && buyPricesArraySortedAsc[0]) { var maxProfitOpportunityPercentage = Number(((sellPricesArrayDesc[0].price - buyPricesArraySortedAsc[0].price)/buyPricesArraySortedAsc[0].price)*100).toFixed(2) };
      for(var i=0; i<$("." + coin + ".buy-row td.buy").length-1; i++) { // Clear all "buy" row cells
        var tempIndex = i + 3;
        $("." + coin + ".buy-row td:nth-child(" + tempIndex + ") .quote-span").text("");
        $("." + coin + ".buy-row td:nth-child(" + tempIndex + ") .auxiliary-span").text("");
      }
      for(var i=0; i<buyPricesArraySortedAsc.length; i++) { // Populate "buy" row cells
        var tempIndex = i + 3;
        $("." + coin + ".buy-row td:nth-child(" + tempIndex + ") .quote-span").text(Number(buyPricesArraySortedAsc[i].price).toFixed(currentCurrency=="BTC" ? 5 : 2));
        $("." + coin + ".buy-row td:nth-child(" + tempIndex + ") .auxiliary-span").text(buyPricesArraySortedAsc[i].provider ? ("(" + buyPricesArraySortedAsc[i].provider + ")") : "");
      }
      for(var i=0; i<$("." + coin + ".sell-row td.sell").length-1; i++) { // Clear all "sell" row cells
        var tempIndex = i + 2;
        $("." + coin + ".sell-row td:nth-child(" + tempIndex + ") .quote-span").text("");
        $("." + coin + ".sell-row td:nth-child(" + tempIndex + ") .auxiliary-span").text("");
      }      
      for(var i=0; i<sellPricesArrayDesc.length; i++) { // Populate "sell" row cells
        var tempIndex = i + 2;
        $("." + coin + ".sell-row td:nth-child(" + tempIndex + ") .quote-span").text(Number(sellPricesArrayDesc[i].price).toFixed(currentCurrency=="BTC" ? 5 : 2));
        $("." + coin + ".sell-row td:nth-child(" + tempIndex + ") .auxiliary-span").text(sellPricesArrayDesc[i].provider ? ("(" + sellPricesArrayDesc[i].provider + ")") : "");      
      }    
      // Clear "profit" row cells
      $("." + coin + ".profit-row .max-profit-cell .number-cell").text("");
      $("." + coin + ".profit-row .max-profit-cell .currency-auxiliary-span").text("");
      $("." + coin + ".profit-row .max-profit-cell .percentage-cell").text(""); 
      // Populate "profit" row cells     
      $("." + coin + ".profit-row .max-profit-cell .number-cell").text(maxProfitOpportunityNumber);
      $("." + coin + ".profit-row .max-profit-cell .currency-auxiliary-span").text(dataObject[coin].currency);
      $("." + coin + ".profit-row .max-profit-cell .percentage-cell").text(maxProfitOpportunityPercentage);
    }
  }

  function clearDataAnalysis() {
    for(var i=0; i<$(".BTC.buy-row td.buy").length-1; i++) { // Clear all "buy" row cells for all rows
      var tempIndex = i + 3;
      $(".BTC.buy-row td:nth-child(" + tempIndex + ") .quote-span").text("");
      $(".BTC.buy-row td:nth-child(" + tempIndex + ") .auxiliary-span").text("");
      $(".ETH.buy-row td:nth-child(" + tempIndex + ") .quote-span").text("");
      $(".ETH.buy-row td:nth-child(" + tempIndex + ") .auxiliary-span").text("");
      $(".LTC.buy-row td:nth-child(" + tempIndex + ") .quote-span").text("");
      $(".LTC.buy-row td:nth-child(" + tempIndex + ") .auxiliary-span").text("");
      $(".XRP.buy-row td:nth-child(" + tempIndex + ") .quote-span").text("");
      $(".XRP.buy-row td:nth-child(" + tempIndex + ") .auxiliary-span").text("");
      $(".BCH.buy-row td:nth-child(" + tempIndex + ") .quote-span").text("");
      $(".BCH.buy-row td:nth-child(" + tempIndex + ") .auxiliary-span").text("");                        
    } 
    for(var i=0; i<$(".BTC.sell-row td.sell").length-1; i++) { // Clear all "sell" row cells for all rows
      var tempIndex = i + 2;
      $(".BTC.sell-row td:nth-child(" + tempIndex + ") .quote-span").text("");
      $(".BTC.sell-row td:nth-child(" + tempIndex + ") .auxiliary-span").text("");
      $(".ETH.sell-row td:nth-child(" + tempIndex + ") .quote-span").text("");
      $(".ETH.sell-row td:nth-child(" + tempIndex + ") .auxiliary-span").text("");
      $(".LTC.sell-row td:nth-child(" + tempIndex + ") .quote-span").text("");
      $(".LTC.sell-row td:nth-child(" + tempIndex + ") .auxiliary-span").text("");
      $(".XRP.sell-row td:nth-child(" + tempIndex + ") .quote-span").text("");
      $(".XRP.sell-row td:nth-child(" + tempIndex + ") .auxiliary-span").text("");
      $(".BCH.sell-row td:nth-child(" + tempIndex + ") .quote-span").text("");
      $(".BCH.sell-row td:nth-child(" + tempIndex + ") .auxiliary-span").text("");                        
    }     
    // Clear "profit" row cells
    $(".profit-row .max-profit-cell .number-cell").text("");
    $(".profit-row .max-profit-cell .currency-auxiliary-span").text("");
    $(".profit-row .max-profit-cell .percentage-cell").text("");       
  }

  // Sortable Code
  var fixHelperModified = function(e, tr) {
    var $originals = tr.children();
    var $helper = tr.clone();

    $helper.children().each(function(index) {
      $(this).width($originals.eq(index).width())
    });
    
    return $helper;
  };

  $(".table-sortable tbody").sortable({
    helper: fixHelperModified      
  }).disableSelection();

  $(".table-sortable thead").disableSelection();

  // $("#add_row").trigger("click");

});

var coinCodes = [
"300",
"611",
"808",
"888",
"VUC",
"SLEVIN",
"FAIR",
"EOS",
"WABI",
"SANDG",
"QSP",
"MONA",
"PLBT",
"ZET",
"XIOS",
"KIC",
"BQX",
"CXT",
"SRC",
"ALIS",
"HSR",
"BLOCKPAY",
"POT",
"SC",
"BLAS",
"EREAL",
"CAG",
"VIA",
"SAC",
"RMC",
"MRJA",
"STRAT",
"PUT",
"VOISE",
"OPT",
"OCL",
"BCN",
"CONX",
"ICN",
"XLM",
"QRL",
"GRWI",
"ZCG",
"LBC",
"PIGGY",
"ARCO",
"RBY",
"CASINO",
"CRB",
"CHC",
"ICON",
"BTM2",
"ULA",
"APX",
"LSK",
"LUN",
"LOG",
"PGL",
"THC",
"KED",
"LMC",
"AIR",
"XNN",
"XVC",
"UNITS",
"NOBL",
"FTC",
"MBRS",
"BLITZ",
"SOIL",
"XCRE",
"POP",
"TIT",
"SIB",
"ZZC",
"KAYI",
"NEOS",
"BRO",
"EAC",
"CACH",
"POE",
"RIDE",
"CRAVE",
"BMC",
"PHO",
"SUPER",
"XLR",
"XPM",
"SOCC",
"FAL",
"PRG",
"QTM",
"EMB",
"CFI",
"COB",
"XEM",
"EUR",
"NAUT",
"BON",
"UFR",
"PBL",
"VIBE",
"EMC2",
"MONK",
"MNX",
"ICE",
"PAYX",
"XRA",
"XAUR",
"CRTM",
"PIRL",
"ANTI",
"KCS",
"EBST",
"BUMBA",
"DDF",
"REX",
"UNITY",
"GNT",
"ION",
"MLN",
"PULSE",
"BOST",
"NLG",
"NVST",
"BRAIN",
"QCN",
"VTA",
"ASAFE2",
"XRE",
"ZRC",
"MUSIC",
"CSNO",
"XEL",
"CUBE",
"NMR",
"AERM",
"FUCK",
"FCN",
"WYV",
"ARK",
"URO",
"MILO",
"LTCR",
"PKB",
"EVO",
"DNA",
"WISH",
"SLING",
"QASH",
"USNBT",
"FLVR",
"FLDC",
"BWK",
"DGD",
"WOMEN",
"GPU",
"RDD",
"ORLY",
"PXI",
"EMD",
"VEE",
"EMV",
"DES",
"DGPT",
"LANA",
"MANA",
"GOOD",
"XDN",
"PRX",
"BBC",
"KRB",
"TKN",
"FJC",
"SOAR",
"AGRS",
"PHR",
"NODC",
"BITSILVER",
"NETKO",
"BTSR",
"FUZZ",
"XGOX",
"SWT",
"BTS",
"XCT",
"CAD",
"STV",
"MAX",
"HNC",
"PND",
"DUO",
"MOJO",
"BIP",
"RSGP",
"B3",
"SSS",
"PRC",
"BNX",
"CPC",
"EVIL",
"UNIT",
"G3N",
"FCT",
"EGAS",
"NMC",
"RKC",
"SAFEX",
"EAGLE",
"IMX",
"DP",
"ZCL",
"CLAM",
"CRDNC",
"ADX",
"XMG",
"LCP",
"CAGE",
"USD",
"AMMO",
"SLS",
"LEND",
"GUP",
"LBTC",
"PXC",
"NSR",
"LNK",
"NEVA",
"ENRG",
"HUC",
"BVC",
"FLAX",
"ERC20",
"KLC",
"PURE",
"FRN",
"CARBON",
"STORJ",
"PPT",
"TAG",
"PURA",
"BCU",
"DOT",
"GXS",
"OXY",
"POST",
"FRAZ",
"IFLT",
"VISIO",
"J",
"CCT",
"TRIG",
"GLD",
"IXC",
"SAGA",
"ATS",
"KLN",
"NDAO",
"ISL",
"UTC",
"IFT",
"CNC",
"VC",
"LDOGE",
"VLT",
"PIPL",
"AUR",
"VSX",
"ORB",
"WTC",
"BCPT",
"NDC",
"SCL",
"BIOS",
"VERI",
"NBT",
"DPY",
"1ST",
"NOTE",
"PEX",
"RED",
"SCS",
"2GIVE",
"BASH",
"IND",
"DRS",
"RUSTBITS",
"RBIES",
"POLL",
"EQT",
"BRIA",
"HEAT",
"EL",
"XCXT",
"RRT",
"GLT",
"SPACE",
"JOBS",
"VIB",
"DNT",
"XFT",
"FNC",
"XBC",
"ECN",
"DAT",
"IOP",
"ZENI",
"HAL",
"BBT",
"BERN",
"FLY",
"COSS",
"ARGUS",
"YASH",
"CAP",
"WARP",
"VIDZ",
"HODL",
"PSB",
"DIX",
"BCH",
"ATCC",
"BTPL",
"ECOB",
"USDT",
"AU",
"OS76",
"TZC",
"AGLC",
"LTB",
"TSTR",
"XBTS",
"MOIN",
"TIPS",
"KNC2",
"TRX",
"EMC",
"8BIT",
"TNT",
"DAS",
"ALQO",
"LRC",
"GBC",
"NTRN",
"ATX",
"RVT",
"PASL",
"WHL",
"BCY",
"ETBS",
"PLR",
"BTC",
"UNY",
"ENJ",
"CBX",
"RISE",
"TAAS",
"GSR",
"DTB",
"YOC",
"WDC",
"RDN",
"STEPS",
"GBYTE",
"BQ",
"LIR",
"CTO",
"GCR",
"OAX",
"MEOW",
"ENG",
"FRST",
"FST",
"ARC2",
"SAN",
"CRM",
"PPP",
"VTR",
"VRC",
"BLZ",
"GAIA",
"ARI",
"GRIM",
"UNO",
"NTO",
"NUKO",
"ALL",
"STS",
"CHESS",
"OBITS",
"CON",
"FRC",
"BIOB",
"PLNC",
"CAT",
"BIS",
"BRAT",
"XCO",
"HTML5",
"AHT",
"RLC",
"VAL",
"BT1",
"BCF",
"PDC",
"CVC",
"ESP",
"CDT",
"TROLL",
"KMD",
"AMBER",
"JS",
"YOYOW",
"ETHD",
"ERY",
"ARB",
"DIME",
"XNG",
"WTT",
"SJCX",
"TAJ",
"PIX",
"EPY",
"XAS",
"GTC",
"SWING",
"SPT",
"MNE",
"SH",
"CASH",
"VTC",
"BUCKS",
"SMLY",
"ARC",
"RNS",
"ELTCOIN",
"JPY",
"NXT",
"ITI",
"AVT",
"SFC",
"B2B",
"HPC",
"TOR",
"SHIFT",
"COAL",
"DFT",
"STA",
"WMC",
"RUP",
"BET",
"ADST",
"BNB",
"PASC",
"BLN",
"PX",
"DOVU",
"MDA",
"BUZZ",
"TSE",
"APW",
"TCC",
"ETG",
"IBANK",
"ONION",
"TKR",
"RADS",
"MSCN",
"HVN",
"CREA",
"BTM",
"HMP",
"ITZ",
"HXX",
"ADT",
"MUT",
"ADZ",
"ATM",
"EFYT",
"ARN",
"MAG",
"UNI",
"C2",
"XJO",
"BTCR",
"GBG",
"ATL",
"XPD",
"CNO",
"IETH",
"PROC",
"KIN",
"FUNK",
"SCRT",
"WAY",
"KUSH",
"ZEPH",
"LTC",
"GAS",
"ELLA",
"SBD",
"BENJI",
"MAR",
"LKK",
"ETN",
"CRYPT",
"CADASTRAL",
"BTWTY",
"FRD",
"MTNC",
"GEO",
"XPTX",
"MER",
"INXT",
"XTO",
"DRT",
"BSC",
"ICN2",
"I0C",
"RIC",
"RUPX",
"MAC",
"SMART",
"BLOCK",
"SKIN",
"XUC",
"MOON",
"SPRTS",
"BTB",
"MNC",
"BRK",
"MBI",
"DRXNE",
"INK",
"TEK",
"REP",
"KORE",
"UET",
"TRUST",
"SYS",
"TRK",
"VOT",
"BCC",
"NVC",
"EXP",
"POSW",
"EMP",
"ZMC",
"INPAY",
"BDL",
"BUN",
"MND",
"BTCRED",
"ZNY",
"XST",
"QVT",
"EBET",
"VRM",
"MYST",
"ASTRO",
"TTC",
"IMS",
"REAL",
"TAGR",
"CNT",
"ATB",
"JIO",
"ANC",
"BTCZ",
"VIP",
"DLT",
"TGT",
"MRT",
"BBR",
"SLFI",
"IFC",
"COLX",
"MAO",
"DIVX",
"CPN",
"LUX",
"HONEY",
"SEQ",
"GLC",
"XBTC21",
"NYC",
"LINX",
"XRP",
"MEC",
"REE",
"LOT",
"SUMO",
"SUB",
"ANT",
"BAS",
"GP",
"TRC",
"MUE",
"BURST",
"NYAN",
"DVC",
"URC",
"GNO",
"CRT",
"XCN",
"PAC",
"JIN",
"SGR",
"CMPCO",
"NAS",
"XLC",
"DOPE",
"PTOY",
"GAP",
"OTX",
"BTCS",
"WCT",
"DLC",
"SNGLS",
"TES",
"SCORE",
"AION",
"BLC",
"TGC",
"MRNG",
"WGR",
"TALK",
"CORG",
"PLACO",
"GIM",
"FLIK",
"ZYD",
"XCPO",
"DCN",
"CND",
"UFO",
"BELA",
"CSC",
"HUSH",
"IGNIS",
"SMOKE",
"FLIXX",
"OCT",
"CV2",
"TRI",
"FC2",
"FYN",
"METAL",
"ROC",
"PR",
"SPANK",
"BYC",
"FYP",
"HGT",
"DBET",
"PZM",
"BSTAR",
"E4ROW",
"PAY",
"DSH",
"ICOB",
"ECO",
"REV",
"DASH",
"XDG",
"BQC",
"CCN",
"ETT",
"TX",
"PFR",
"CAB",
"CESC",
"DICE",
"MYB",
"ADA",
"ELIX",
"HOLD",
"BTG2",
"GRID",
"SNRG",
"NEO",
"LIFE",
"WAVES",
"STX",
"FLT",
"GAM",
"ROOFS",
"BTQ",
"XVP",
"UNIC",
"ITT",
"NET2",
"ONX",
"KNC",
"TYCHO",
"PPC",
"GVT",
"RCN",
"SDRN",
"MAY",
"GBX",
"SIGT",
"PLU",
"BRIT",
"FUEL",
"ACC",
"EGO",
"PTC",
"SKY",
"WORM",
"TOA",
"NANOX",
"ENT",
"ADC",
"LINK",
"MCAP",
"TRUMP",
"ADCN",
"POWR",
"IOT",
"CRW",
"POS",
"DBTC",
"LTCU",
"ZER",
"XZC",
"DCY",
"RC",
"MTH",
"VOLT",
"STEEM",
"DEM",
"UNIFY",
"EBCH",
"CMT",
"WBB",
"COVAL",
"QAU",
"EOT",
"DCT",
"FIMK",
"EBT",
"DAXX",
"GAME",
"EFL",
"KURT",
"RHOC",
"NTWK",
"GPL",
"XMCC",
"SYNX",
"HYP",
"BAT",
"BAY",
"MNM",
"START",
"SNM",
"VRS",
"HBT",
"UIS",
"ZEC",
"ELE",
"PST",
"DYN",
"INSN",
"BXT",
"CLOAK",
"AE",
"PIE",
"EDO",
"MSP",
"DOLLAR",
"EXN",
"MST",
"GRS",
"NLC2",
"KRONE",
"DATA",
"ALTC",
"INFX",
"RLT",
"GEERT",
"JINN",
"RPX",
"JWL",
"CTIC2",
"RIYA",
"BITCNY",
"AMB",
"EBTC",
"REQ",
"OMG",
"GRE",
"LA",
"MEME",
"LINDA",
"HAT",
"CLUB",
"LEO",
"BT2",
"MARS",
"SPHR",
"ALTCOM",
"NXC",
"NAV",
"BNT",
"HST",
"CYP",
"SDP",
"EGC",
"YYW",
"XRC",
"BITS",
"SLG",
"ERC",
"CAT2",
"XHI",
"BSTY",
"GRT",
"HERO",
"STR",
"SONG",
"RMC2",
"PING",
"TRST",
"GOLOS",
"DMD",
"ECC",
"NKA",
"BTDX",
"PIVX",
"CCO",
"BOT",
"CURE",
"SXC",
"HDG",
"FUN",
"GCC",
"DGB",
"PBT",
"XRL",
"TRCT",
"DBIX",
"SHORTY",
"ETP",
"CCRB",
"MAD",
"CFT",
"SMC",
"LVPS",
"SPR",
"CWXT",
"BITGOLD",
"BITEUR",
"ZEIT",
"ALT",
"Q2C",
"MTL",
"STCN",
"CFD",
"BPL",
"CF",
"GB",
"KOBO",
"ABJ",
"USC",
"VLTC",
"FXE",
"XC",
"VEN",
"XSPEC",
"DIBC",
"RAIN",
"UKG",
"R",
"NXS",
"WGO",
"DALC",
"SWIFT",
"PRO",
"IXT",
"CNNC",
"ETH",
"BITZ",
"ARG",
"OK",
"NRO",
"BOAT",
"XPY",
"OPAL",
"DNR",
"CREVA",
"ITNS",
"MTM",
"BTA",
"PONZI",
"SHDW",
"AST",
"GMT",
"GRC",
"BTX2",
"CJ",
"ACOIN",
"HVCO",
"PEPECASH",
"MOD",
"EVX",
"RPC",
"DGCS",
"JET",
"MZC",
"VPRC",
"PAK",
"P7C",
"GBP",
"OTN",
"ETHOS",
"DLISK",
"INN",
"CTR",
"GUN",
"BBP",
"PPY",
"WINGS",
"RBX",
"020",
"EUC",
"SIFT",
"MXT",
"COXST",
"XCS",
"XMR",
"JNS",
"OMNI",
"CRC",
"TKS",
"ARDR",
"XBL",
"FIRE",
"XCP",
"BCO",
"BCAP",
"AMP",
"PHS",
"ZRX",
"MAGE",
"ZUR",
"ART",
"FUNC",
"PRE",
"PRIX",
"HMQ",
"BITUSD",
"MGM",
"XOC",
"NEBL",
"IMPS",
"ODN",
"VEC2",
"HMC",
"ETC",
"UNB",
"BLRY",
"XBY",
"TIX",
"BLU",
"CREDO",
"ADL",
"XPA",
"NIO",
"KEK",
"PART",
"DGC",
"IOC",
"MCO",
"ZEN",
"MINT",
"CANN",
"EDR",
"ABY",
"TFL",
"KICK",
"AEON",
"QRK",
"LEA",
"CNX",
"XSH",
"EXCL",
"MCRN",
"QTL",
"GCN",
"LGD",
"DMB",
"QSH",
"ICOO",
"DOGE",
"XMY",
"VOX",
"4CHN",
"XVG",
"XP",
"SPEX",
"BSD",
"CVCOIN",
"RBT",
"STRC",
"ECASH",
"BIGUP",
"CRX",
"HBN",
"BLUE",
"CDN",
"BLK",
"HTC",
"CALC",
"BITB",
"CMP",
"V",
"DRGN",
"QWARK",
"ATOM",
"INCNT",
"MGO",
"NET",
"XGR",
"SDC",
"MAID",
"TNB",
"CHIPS",
"OFF",
"FRK",
"BRX",
"FLO",
"QTUM",
"BPC",
"PINK",
"AC",
"ACP",
"TIME",
"ZOI",
"XWC",
"SLM",
"XRB",
"DRP",
"SNC",
"YAC",
"ECA",
"ACT",
"DENT",
"VSL",
"SLR",
"ICOS",
"DCR",
"ELS",
"BOLI",
"DRM",
"SALT",
"EDG",
"MTLMC3",
"OHM",
"LUNA",
"NEWB",
"ATMS",
"ZSC",
"ABN",
"PRL",
"DAR",
"SNT",
"CTX",
"USDE",
"BTCD",
"BTG",
"UBQ",
"VIVO",
"SOON"
];