(function(){
  var D={
    before:{n:10,rows:[['100%','7 failing','bad'],['100%','2 failing','bad'],['100%','4 failing','bad']]},
    after:{n:96,rows:[['25%','2 to review','warn'],['0%','All fixed','ok'],['0%','All fixed','ok']]}
  };
  var rows=document.getElementById('scRows').children;
  function show(k){
    var d=D[k];
    document.getElementById('scNum').textContent=d.n;
    document.getElementById('scFill').style.width=d.n+'%';
    document.getElementById('scRows').className='sc-rows'+(k==='after'?' after':'');
    for(var i=0;i<rows.length;i++){
      rows[i].querySelector('.track i').style.width=d.rows[i][0];
      var p=rows[i].querySelector('.pill');p.textContent=d.rows[i][1];p.className='pill '+d.rows[i][2];
    }
  }
  var radios=document.querySelectorAll('input[name="st"]');
  for(var i=0;i<radios.length;i++)radios[i].addEventListener('change',function(){if(this.checked)show(this.value)});
})();
