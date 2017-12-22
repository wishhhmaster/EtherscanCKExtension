// If you find this script useful, donations or kitties are welcome :) 0x589871abf6f300f0bcc574e5b6e554e64031a384
// ==UserScript==
// @name         Etherscan CK Extension
// @namespace    https://github.com/wishhhmaster/EtherscanCKExtension
// @version      0.3
// @description  Adds visual info about transactions
// @author       Wishhhmaster
// @match        *.etherscan.io/*

// @grant        none
// ==/UserScript==

let styles = `<style> 
.catLink { display: inline-block; } .catImg {width: 150px}
.summaryCatImg{width: 55px;}
.father{ border: solid 1px royalblue;}
td.extraInfo {width: 200px;}
.usdPrice{ font-size: 10px;}

</style>`;

const CKProfileBaseUrl = "https://www.cryptokitties.co/kitty/";
const CKGetKittyUrl = "https://api.cryptokitties.co/kitties/";

let ethUSDPrice = 0;
/**
 * Constants method names
 */
const MethodNames = {
  BidOnSaleAuction: "bid",
  CancelAuction: "cancelAuction",
  BidOnSiringAuction: "bidOnSiringAuction",
  BreedWithAuto: "breedWithAuto",
  CreateSaleAuction: "createSaleAuction",
  CreateSiringAuction: "createSiringAuction",
};

/**
 * Helper methods
 */
class KittyUtils {
  /**
   * Converts a hex parameter from the transaction's input data field into a decimal integer
   * @param extParamLines
   * @param lineIndex
   * @returns {Number}
   */
  static getIntValueFromHexParam(extParamLines, lineIndex)
  {

    let hexVal = extParamLines[lineIndex].split(":")[1];
    return parseInt(hexVal, 16);
  }

  /**
   * Formats a durations from seconds to number of days
   * @param durationInSeconds
   * @returns {string}
   */
  static formatDuration(durationInSeconds)
  {
    let duration = (durationInSeconds / (3600 * 24)).toPrecision(1);
    if (duration == parseInt(duration))
    {
      duration = parseInt(duration);
    }
    return duration;
  }
}

/**
 *
 */
class TransactionParser {

  /**
   * Parses a transaction details
   * @param content
   * @returns {Promise}
   */
  parseTransactionDetailsInputData(content)
  {

    return new Promise((resolve, reject) =>
    {

      let buff = content.split("\n");
      let nameRegexp = /Function: (.*)\(/g;
      let matches = nameRegexp.exec(buff[0]);
      let methodName = matches[1];
      //debugger;
      let data = {
        methodName: methodName,
        methodDescription: '',
        args: []
      };
      switch (methodName)
      {
        case MethodNames.CancelAuction:
        case MethodNames.BidOnSaleAuction:
        {
          data.methodDescription = methodName === MethodNames.CancelAuction ? "Cancel siring auction" : "Bid to buy a kitty";
          let kittyId = KittyUtils.getIntValueFromHexParam(buff, 3);
          data.args.push({
            "kittyId": kittyId,
            link: CKProfileBaseUrl + kittyId
          });

          $.getJSON(CKGetKittyUrl + kittyId, respData =>
          {
            data.args[0].name = respData.name;
            data.args[0].apiData = respData;
            resolve(data);
          });
          break;
        }

        case MethodNames.BidOnSiringAuction:
        case MethodNames.BreedWithAuto:
        {
          let isAutoBreed = methodName === MethodNames.BreedWithAuto;

          if (isAutoBreed)
          {
            data.methodDescription = "Breed with own kitties";
          }
          else
          {
            data.methodDescription = "Bid on siring auction";
          }


          let sireKittyId = KittyUtils.getIntValueFromHexParam(buff, 3);
          let matronKittyId = KittyUtils.getIntValueFromHexParam(buff, 4);
          if (isAutoBreed)
          {
            matronKittyId = KittyUtils.getIntValueFromHexParam(buff, 3);
            sireKittyId = KittyUtils.getIntValueFromHexParam(buff, 4);
          }

          data.args.push({
            "sireKittyId": sireKittyId,
            link: CKProfileBaseUrl + sireKittyId,
          }, {
            "matronKittyId": matronKittyId,
            link: CKProfileBaseUrl + matronKittyId
          });

          $.getJSON(CKGetKittyUrl + matronKittyId, respData =>
          {
            data.args[1].name = respData.name;
            data.args[1].father = false;
            data.args[1].apiData = respData;

            $.getJSON(CKGetKittyUrl + sireKittyId, respData =>
            {
              data.args[0].name = respData.name;
              data.args[0].father = true;
              data.args[0].apiData = respData;
              resolve(data);

            });
          });
          break;
        }

        case MethodNames.CreateSaleAuction:
        case MethodNames.CreateSiringAuction:
        {
          data.methodDescription = MethodNames.CreateSaleAuction ? "Create sale auction" : "Create siring auction";
          let kittyId = KittyUtils.getIntValueFromHexParam(buff, 3);
          let startPriceInEth = (KittyUtils.getIntValueFromHexParam(buff, 4) / 1000000000) / 1000000000;
          let endPriceInEth = (KittyUtils.getIntValueFromHexParam(buff, 5) / 1000000000) / 1000000000;
          let durationInSeconds = KittyUtils.getIntValueFromHexParam(buff, 6);


          data.args.push({
              "kittyId": kittyId,
              link: CKProfileBaseUrl + kittyId
            },
            {
              startPrice: startPriceInEth,
              endPrice: endPriceInEth,
              duration: durationInSeconds,
            }
          );

          $.getJSON(CKGetKittyUrl + kittyId, respData =>
          {
            data.args[0].name = respData.name;
            data.args[0].apiData = respData;
            resolve(data);
          });

          break;
        }

      }
    });

  }

}

/**
 *
 */
class HtmlHelper {

  /**
   * Gets the html description of of CK transaction
   * @param data
   * @returns {string}
   */
  getHtmlForData(data)
  {
    let html = `<span>${data.methodDescription}</span>`;
    let kittyArg = data.args[0];
    let kittyArg2 = data.args.length > 1 && data.args[1].link ? data.args[1] : null;
    let auctionArg = data.args.length > 1 && data.args[1].startPrice ? data.args[1] : null;
    html += "<div>";
    let name = kittyArg.apiData.name ? kittyArg.apiData.name : `#${kittyArg.apiData.id}`;
    let fatherClass = kittyArg.father ? "father" : "";

    html += `<a class="summaryCatLink" title="${name} ${kittyArg.father ? 'FATHER' : ''}" href='${kittyArg.link}' target="_blank"><img class="summaryCatImg ${fatherClass}" src="${kittyArg.apiData.image_url}" /></a>`;
    if (kittyArg2)
    {
      let name = kittyArg2.apiData.name ? kittyArg2.apiData.name : `#${kittyArg2.apiData.id}`;
      let fatherClass2 = kittyArg2.father ? "father" : "";
      html += `<a class="summaryCatLink" title="${name} ${kittyArg2.father ? 'FATHER' : ''}" href='${kittyArg2.link}' target="_blank"><img class="summaryCatImg ${fatherClass2}" src="${kittyArg2.apiData.image_url}" /></a>`;
    }
    else if (auctionArg)
    {
      html += `<div><span>From ${auctionArg.startPrice} ETH</span> to `;
      html += `<span>${auctionArg.endPrice} ETH</span></div>`;
      html += `<div>Duration: <span>${KittyUtils.formatDuration(auctionArg.duration)} day(s)</span></div>`;
    }
    html += "</div";
    return html;
  }

  /**
   * Adds data on top of the transaction details page
   * @param data
   */
  displayDataForTransactionDetails(data)
  {
    $('#txOverview').remove();
    let elt = $(`<div id='txOverview'>${this.getHtmlForData(data)} </div>`);
    elt.insertAfter($('.panel-heading'));
  }

  /**
   * Adds an extra column to the transactions/internal transactions table
   * with the data collected by going into the transaction's details
   * @param table
   */
  addDetailsToTable(table, hasTxFee)
  {
    table.find("tr").each((idx, elt) =>
      {
        let trElt = $(elt);
        //debugger;
        let th = trElt.find("th").first();
        if (th.length)
        {
          if (!th.hasClass("extraInfo"))
          {
            $("<th class='extraInfo'>Extra</th>").insertBefore(th);
          }
          return;
        }
        let td = trElt.find("td").first();
        if (!td.hasClass("extraInfo"))
        {
          $("<td class='extraInfo'></td>").insertBefore(td);
          td = trElt.find("td").first();
        }
        let transactionId = $(trElt.find("td").get(1)).find("a").html();
        let savedData = localStorage.getItem(transactionId);
        if (savedData)
        {
          savedData = JSON.parse(savedData);
          td.html(this.getHtmlForData(savedData));
        }

        let nbTdsToAddPrice = hasTxFee ? 2 : 1;
        trElt.find("td").slice(-nbTdsToAddPrice).each((idx, elt) =>
        {
          let priceTd = $(elt);
          if(priceTd.attr("data-usePrice"))
          {
            return;
          }
          let amountInEth = parseFloat(priceTd.text().replace("Ether", ""));
          let priceInUSD = (amountInEth * ethUSDPrice).toFixed(2);
          let usdPriceElt = $(`<div class="usdPrice">($${priceInUSD})</div>`);
          priceTd.append(usdPriceElt);
          priceTd.attr("data-usePrice", "1");
        });


      }
    );
  }
}

class Main {
  /**
   * Continuously checks if we are on a different page, and calls processScriptForNewPage
   * to udpdate the page if we are
   */
  doCheckUrlLoop()
  {
    let fireOnHashChangesToo = true;
    setInterval(
      () =>
      {
        if (this.lastPathStr !== location.pathname
          || this.lastQueryStr !== location.search
          || (fireOnHashChangesToo && this.lastHashStr !== location.hash)
        )
        {
          this.lastPathStr = location.pathname;
          this.lastQueryStr = location.search;
          this.lastHashStr = location.hash;

          this.processScriptForNewPage();
        }
      }
      , 1000);
  }

  /**
   * Adds more data to the page
   */
  processScriptForNewPage()
  {
    let htmlHelper = new HtmlHelper();

    let transactionParser = new TransactionParser();
    let inputDataElt = $('#inputdata');

    if (inputDataElt.length)
    {
      let transactionId = $('h1 .lead-modify').html().replace("&nbsp;", '');
      if (localStorage.getItem(transactionId))
      {
        htmlHelper.displayDataForTransactionDetails(JSON.parse(localStorage.getItem(transactionId)));
      }
      else
      {
        transactionParser.parseTransactionDetailsInputData(inputDataElt.text()).then(data =>
        {
          localStorage.setItem(transactionId, JSON.stringify(data));
          htmlHelper.displayDataForTransactionDetails(data);
        });
      }

    }
    let mainAdress = $('#mainaddress');

    if (location.pathname === "/txs")//Page that lists ALL transactions for an account
    {
      htmlHelper.addDetailsToTable($('#ContentPlaceHolder1_mainrow  table'), true);
    }
    else if (mainAdress.length) //Account page
    {
      if (location.hash === "#internaltx")//Internal transactions Tab
      {
        htmlHelper.addDetailsToTable($('#internaltx table'), false);
      }
      else if (location.hash === "")//Transactions for normal account
      {
        htmlHelper.addDetailsToTable($('#transactions table'), true);
      }
    }
  }
}

/**
 * Entry point
 */
$(document).ready(() =>
{
  console.log('Etherscan CK Extension loaded');
  $("head").append(styles);
  let main = new Main();

  $.getJSON("https://api.coinmarketcap.com/v1/ticker/ethereum/", data =>
  {
    ethUSDPrice = parseFloat(data[0].price_usd);
    main.doCheckUrlLoop();
  });

})
;
