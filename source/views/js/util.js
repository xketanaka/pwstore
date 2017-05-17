
const Util = {
  esc: (string)=>{
    if(typeof string !== 'string'){
      return string;
    }
    return string.replace(/[&'`"<>]/g, (match)=>{
      return {
        '&': '&amp;',
        "'": '&#x27;',
        '`': '&#x60;',
        '"': '&quot;',
        '<': '&lt;',
        '>': '&gt;',
      }[match]
    });
  },
  displayString: (string, len)=>{
    if(!string) return string;
    if(string.length <= len) return string;
    return string.slice(0, len - 3) + "...";
  },
  triggerEvent: (element, eventName)=>{
    var evt = document.createEvent("HTMLEvents");
    evt.initEvent(eventName, true, true ); // event type, bubbling, cancelable
    return element.dispatchEvent(evt);
  },
  Array: (arrayLikeObject)=>{
    return Array.prototype.slice.call(arrayLikeObject);
  }
}
